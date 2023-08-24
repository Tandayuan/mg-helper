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
    // 获取当前鼠标光标位置position.character，基于位置分别向前和向后遍历截取积累文本，遇到黑名单列表blackList中的元素停止遍历；
    // 返回最终积累的文本mateText后和reg正则表达式匹配成功表示正确选中目标文本sourceStr。
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

    // F12匹配到符合reg规则的文本
    const sourceStr = reg.test(mateText) && mateText;
    if (sourceStr) {
      let pos = 0;
      // 对整个文档进行遍历, 文档中的每一行文本逐一和sourceStr匹配。
      // 跳转条件：行文本是符合caseReg规则的文本mateStr, mateStr再和sourceStr配对成功, 跳转到mateStr在文档中所处的位置。
      let flagStr = "";
      while (pos <= document.lineCount) {
        const lineItem = document.lineAt(pos++);
        const lineItemText = lineItem.text;
        if (lineItemText.includes("getDefaultTableColumnList")) {
          flagStr = "ColumnList";
        } else if (lineItemText.includes("getTableRenderList")) {
          flagStr = "RenderList";
        }
        const caseReg =
          /^\s*.*[case]\s*['|"](\w+[ColumnList])['|"]\s*[:]\s*.*$/g;
        const mateStr =
          caseReg.test(lineItemText) && lineItemText.replace(caseReg, "$1");
        if (mateStr && sourceStr.includes(flagStr)) {
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
    return null;
  }
}
