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
    const reg = /^\s*.*'(\w+[ColumnList|RenderList])'.*$/g;
    // F12匹配到符合reg规则的文本
    const sourceStr = reg.test(text) && text.replace(reg, "$1");
    if (sourceStr) {
      let pos = 0;
      // 对整个文档进行遍历, 文档中的每一行文本逐一和sourceStr匹配。
      // 跳转条件：行文本是符合caseReg规则的文本mateStr, mateStr再和sourceStr配对成功, 跳转到mateStr在文档中所处的位置。
      while (pos <= document.lineCount) {
        const lineItem = document.lineAt(pos++);
        const lineItemText = lineItem.text;
        const caseReg = /^\s*.*[case]\s*'(\w+[ColumnList|RenderList])'.*$/g;
        const mateStr = caseReg.test(lineItemText) && lineItemText.replace(reg, "$1");
        if (mateStr && mateStr === sourceStr) {
          return new Location(
            document.uri,
            new Position(lineItem.lineNumber, lineItemText.indexOf(mateStr) + mateStr.length)
          );
        }
      }
    }
    return null;
  }
}
