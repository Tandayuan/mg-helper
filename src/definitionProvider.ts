import {
  CancellationToken,
  Definition,
  DefinitionProvider,
  Location,
  LocationLink,
  Position,
  ProviderResult,
  TextDocument,
  TextLine,
} from "vscode";

export class MyDefinitionProvider implements DefinitionProvider {
  provideDefinition(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ): ProviderResult<Definition | LocationLink[]> {
    const lineText = document.lineAt(position.line);
    const text = lineText.text;
    // 按下F12或者ctrl+左键后可以获取当前鼠标光标位置行索引position.character，基于位置分别向前和向后遍历截取积累文本，遇到黑名单列表blackList中的元素停止遍历；
    // 返回最终积累的文本mateText后和reg正则表达式匹配成功表示正确选中文本sourceStr。
    const reg = /^\w+[ColumnList|RenderList]$/g;
    let mateText = "";
    const blackList = ['"', "'", ":", " "];
    let pos = position.character;
    let pt = text.charAt(pos);
    while (!blackList.includes(pt) && pos < text.length) {
      mateText += pt;
      pt = text.charAt(++pos);
    }
    let bos = position.character - 1;
    let bt = text.charAt(bos);
    while (!blackList.includes(bt) && bos >= 0) {
      mateText = bt + mateText;
      bt = text.charAt(--bos);
    }
    const sourceStr = reg.test(mateText) && mateText;
    const sourceStrLineNumber = lineText.lineNumber;
    if (sourceStr) {
      let pos = 0;
      let flagStr = "";
      let isMethods = false;
      const methodsReg = /^\s*.*methods\s*.*:\s*.*[{]\s*.*$/g;
      const caseReg = /^\s*.*case\s*['|"](\w+ColumnList)['|"]\s*:\s*.*$/g;
      let mateObjByInStrFunedSourceStr: TextLine | null = null;
      let mateStrByInStrFunedSourceStr = "";
      let mateObjByOutStrFunedSourceStr: TextLine | null = null;
      let mateStrByOutStrFunedSourceStr = "";
      let flagStrFunLineNumberRangeIndexObj: Record<string, number[]> = {
        columnList: [],
        renderList: [],
      };
      let braceLeftCount = 0;
      function getBraceLeftCount(lineText: string = ""): number {
        let braceLeft = 0,
          braceRight = 0;
        braceLeft = lineText.match(/{/gi) ? lineText.match(/{/gi)!.length : 0;
        braceRight = lineText.match(/}/gi) ? lineText.match(/}/gi)!.length : 0;
        return braceLeft - braceRight;
      }
      while (pos <= document.lineCount) {
        const lineItem = document.lineAt(pos++);
        const lineItemText = lineItem.text;
        // getDefaultTableColumnList和getTableRenderList的方法定义在methods对象里，先判断遍历到methods时赋予状态isMethods，再判断遍历到这两个方法时赋予状态flagStr
        if (!isMethods) {
          isMethods = methodsReg.test(lineItemText);
          if (!isMethods) {
            continue;
          }
        }
        if (isMethods) {
          if (/^[^\S\r\n\w]+getDefaultTableColumnList.*$/g.test(lineItemText)) {
            flagStr = "ColumnList";
            braceLeftCount += getBraceLeftCount(lineItemText);
            flagStrFunLineNumberRangeIndexObj[
              flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
            ][0] = lineItem.lineNumber;
            continue;
          } else if (/^[^\S\r\n\w]+getTableRenderList.*$/g.test(lineItemText)) {
            flagStr = "RenderList";
            braceLeftCount += getBraceLeftCount(lineItemText);
            flagStrFunLineNumberRangeIndexObj[
              flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
            ][0] = lineItem.lineNumber;
            continue;
          }
          // isMethods 和 !!flagStr都是true，代表已经遍历到getDefaultTableColumnList和getTableRenderList的方法内。
          // 开始对遍历的每一行文本匹配caseReg正则表达式，匹配上和符合定制条件（mateStr && isEqul && sourceStr.includes(flagStr)）就跳转到对应文本行。
          if (flagStr) {
            const mateStr =
              caseReg.test(lineItemText) && lineItemText.replace(caseReg, "$1");
            let isEqul =
              mateStr &&
              (sourceStr.substring(0, sourceStr.indexOf("ColumnList")) ||
                sourceStr.substring(0, sourceStr.indexOf("RenderList"))) ===
                mateStr.substring(0, mateStr.indexOf("ColumnList"));
            if (mateStr && isEqul) {
              // 非常规逻辑：在getDefaultTableColumnList和getTableRenderList的方法内的case 'xxx'上按下跳转按键的逻辑；
              if (lineItem.lineNumber !== sourceStrLineNumber) {
                mateObjByInStrFunedSourceStr = lineItem;
                mateStrByInStrFunedSourceStr = mateStr;
                console.log("mg-helper 非常规逻辑记录成功~");
              }
              // 通用逻辑
              if (sourceStr.includes(flagStr)) {
                console.log("mg-helper 通用逻辑记录成功~");
                mateObjByOutStrFunedSourceStr = lineItem;
                mateStrByOutStrFunedSourceStr = mateStr;
              }
            }
            // 计算大括号数量
            braceLeftCount += getBraceLeftCount(lineItemText);
            if (braceLeftCount === 0) {
              flagStrFunLineNumberRangeIndexObj[
                flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
              ][1] = lineItem.lineNumber;
              flagStr = "";
            }
          }
          if (
            flagStrFunLineNumberRangeIndexObj["columnList"].length === 2 &&
            flagStrFunLineNumberRangeIndexObj["renderList"].length === 2
          ) {
            break;
          }
        }
      }
      if (
        flagStrFunLineNumberRangeIndexObj["columnList"].length === 2 &&
        flagStrFunLineNumberRangeIndexObj["renderList"].length === 2
      ) {
        //TODO: 判断sourceStr的行号是出于flagStrFun内还是外，正确填充匹配的的Location对象参数并返回。
        const [columnListStartIndex, columnListEndIndex] =
          flagStrFunLineNumberRangeIndexObj["columnList"];
        const [renderListStartIndex, renderListEndIndex] =
          flagStrFunLineNumberRangeIndexObj["renderList"];
        if (
          mateObjByInStrFunedSourceStr &&
          ((columnListStartIndex < sourceStrLineNumber &&
            sourceStrLineNumber < columnListEndIndex) ||
            (renderListStartIndex < sourceStrLineNumber &&
              sourceStrLineNumber < renderListEndIndex))
        ) {
          return new Location(
            document.uri,
            new Position(
              mateObjByInStrFunedSourceStr.lineNumber,
              mateObjByInStrFunedSourceStr.text.indexOf(
                mateStrByInStrFunedSourceStr
              ) + mateStrByInStrFunedSourceStr.length
            )
          );
        } else if (mateObjByOutStrFunedSourceStr) {
          return new Location(
            document.uri,
            new Position(
              mateObjByOutStrFunedSourceStr.lineNumber,
              mateObjByOutStrFunedSourceStr.text.indexOf(
                mateStrByOutStrFunedSourceStr
              ) + mateStrByOutStrFunedSourceStr.length
            )
          );
        }
      }
    }
    return null;
  }
}
