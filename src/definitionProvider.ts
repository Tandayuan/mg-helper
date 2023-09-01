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
// 获取{大括号的数量
function getBraceLeftCount(lineText: string = ""): number {
  let braceLeft = 0,
    braceRight = 0;
  braceLeft = lineText.match(/{/gi) ? lineText.match(/{/gi)!.length : 0;
  braceRight = lineText.match(/}/gi) ? lineText.match(/}/gi)!.length : 0;
  return braceLeft - braceRight;
}
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
      while (pos <= document.lineCount) {
        const lineItem = document.lineAt(pos++);
        const lineItemText = lineItem.text;
        // getDefaultTableColumnList和getTableRenderList的方法定义在methods对象里，先判断遍历到methods时赋予状态isMethods。
        if (!isMethods) {
          isMethods = methodsReg.test(lineItemText);
          if (!isMethods) {
            continue;
          }
        }
        if (isMethods) {
          // isMethods为true，再判断遍历到这两个方法时，赋予当前遍历处于对应方法内的标志状态flagStr。
          if (/^[^\S\r\n\w]+getDefaultTableColumnList.*$/g.test(lineItemText)) {
            flagStr = "ColumnList";
            // 从进入方法开始记录{大括号的数量，当数量=0说明遍历器已经离开本方法。
            braceLeftCount += getBraceLeftCount(lineItemText);
            // 记录当前方法的开始行号，后续用于判断sourceStrLineNumber是否在方法的起始与结束行号之间。
            flagStrFunLineNumberRangeIndexObj[
              flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
            ][0] = lineItem.lineNumber;
            continue;
          } else if (/^[^\S\r\n\w]+getTableRenderList.*$/g.test(lineItemText)) {
            flagStr = "RenderList";
            // 从进入方法开始记录{大括号的数量，当数量=0说明遍历器已经离开本方法。
            braceLeftCount += getBraceLeftCount(lineItemText);
            // 记录当前方法的开始行号，后续用于判断sourceStrLineNumber是否在方法的起始与结束行号之间。
            flagStrFunLineNumberRangeIndexObj[
              flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
            ][0] = lineItem.lineNumber;
            continue;
          }
          // isMethods 和 !!flagStr都是true，代表已经遍历到getDefaultTableColumnList和getTableRenderList的方法内。
          if (flagStr) {
            const mateStr =
              caseReg.test(lineItemText) && lineItemText.replace(caseReg, "$1");
            // 通过截取ColumnList和RenderList后缀获取字段名前缀去判断sourceStr与mateStr是否相同，避免乱跳到不同名的字段中。
            let isEqul =
              mateStr &&
              (sourceStr.substring(0, sourceStr.indexOf("ColumnList")) ||
                sourceStr.substring(0, sourceStr.indexOf("RenderList"))) ===
                mateStr.substring(0, mateStr.indexOf("ColumnList"));
            if (mateStr && isEqul) {
              // 跳转分为非常规逻辑和常规跳转。
              // 非常规逻辑：在getDefaultTableColumnList和getTableRenderList的方法内的列定制字段名(case 'fieldName':)按下跳转按键（F12或ctrl+左键）。
              // 记录当前行对象mateObjByInStrFunedSourceStr、行匹配文本mateStrByInStrFunedSourceStr后续使用。
              if (lineItem.lineNumber !== sourceStrLineNumber) {
                mateObjByInStrFunedSourceStr = lineItem;
                mateStrByInStrFunedSourceStr = mateStr;
                console.log("mg-helper 非常规逻辑记录成功~");
              }
              // 与上处注解意思相反
              if (sourceStr.includes(flagStr)) {
                console.log("mg-helper 通用逻辑记录成功~");
                mateObjByOutStrFunedSourceStr = lineItem;
                mateStrByOutStrFunedSourceStr = mateStr;
              }
            }
            // 计算当前行的{左大括号数量
            braceLeftCount += getBraceLeftCount(lineItemText);
            // {左大括号数量=0说明当前遍历到flagStr方法的最后一行，重置flagStr为空，等待下一个符合条件的flagStr方法。
            if (braceLeftCount === 0) {
              // 记录当前方法的结束行号，后续用于判断sourceStrLineNumber是否在方法的起始与结束行号之间。
              flagStrFunLineNumberRangeIndexObj[
                flagStr.charAt(0).toLowerCase() + flagStr.slice(1)
              ][1] = lineItem.lineNumber;
              flagStr = "";
            }
          }
          // 由于列定制只在这两方法之间跳转，所以开始和结束行号都有值说明已经对这两个方法完成了遍历，结束循环。
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
        // 根据sourceStrLineNumber是否处于flagStr方法的行号中判断跳转方式（常规跳转/非常规跳转）。
        const [columnListStartIndex, columnListEndIndex] =
          flagStrFunLineNumberRangeIndexObj["columnList"];
        const [renderListStartIndex, renderListEndIndex] =
          flagStrFunLineNumberRangeIndexObj["renderList"];
        // sourceStrLineNumber处于flagStr方法的行号中，进行非常规跳转。
        // 非常规跳转解释：即在getDefaultTableColumnList或getTableRenderList的方法中按下跳转按键，会寻找这两方法中相同的列定制字段名进行来回跳转。
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
          // sourceStrLineNumber不处于flagStr方法的行号中，进行常规跳转。
          // 常规跳转解释：即在getDefaultTableColumnList或getTableRenderList的方法外按下跳转按键，
          // xxxColumnList字段名会跳转到getDefaultTableColumnList方法中匹配的字段名上，xxxRenderList字段名会跳转到getTableRenderList方法中匹配的字段名上。
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
