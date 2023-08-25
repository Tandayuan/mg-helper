import {
  CancellationToken,
  Definition,
  DefinitionProvider,
  Location,
  LocationLink,
  Position,
  ProviderResult,
  TextDocument,
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
    if (sourceStr) {
      let pos = 0;
      let flagStr = "";
      let isMethods = false;
      const methodsReg = /^\s*.*methods\s*.*:\s*.*[{]\s*.*$/g;
      const caseReg = /^\s*.*case\s*['|"](\w+ColumnList)['|"]\s*:\s*.*$/g;
      while (pos <= document.lineCount) {
        const lineItem = document.lineAt(pos++);
        const lineItemText = lineItem.text;
        // getDefaultTableColumnList和getTableRenderList的方法定义在methods对象里，先判断遍历到methods时赋予状态isMethods，再判断遍历到这两个方法时赋予状态flagStr
        if (!isMethods) {
          isMethods = methodsReg.test(lineItemText);
        }
        if (isMethods) {
          if (lineItemText.includes("getDefaultTableColumnList")) {
            flagStr = "ColumnList";
            continue;
          } else if (lineItemText.includes("getTableRenderList")) {
            flagStr = "RenderList";
            continue;
          }
        }
        // isMethods 和 !!flagStr都是true，代表已经遍历到getDefaultTableColumnList和getTableRenderList的方法内。
        // 开始对遍历的每一行文本匹配caseReg正则表达式，匹配上和符合定制条件（mateStr && isEqul && sourceStr.includes(flagStr)）就跳转到对应文本行。
        if (flagStr) {
          const mateStr =
            caseReg.test(lineItemText) && lineItemText.replace(caseReg, "$1");
          let isEqul =
            mateStr &&
            sourceStr.substring(0, sourceStr.indexOf(flagStr)) ===
              mateStr.substring(0, mateStr.indexOf("ColumnList"));
          if (mateStr && isEqul && sourceStr.includes(flagStr)) {
            console.log("mg-helper 跳转成功~");
            return new Location(
              document.uri,
              new Position(
                lineItem.lineNumber,
                lineItemText.indexOf(mateStr) + mateStr.length
              )
            );
          }
        }
      }
    }
    return null;
  }
}
