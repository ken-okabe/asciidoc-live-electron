import { T, now } from "./timeline-monad";
import { allTL } from "./allTL";
import * as vscode from 'vscode';

const path = require('path');

interface timeline {
  type: string;
  [now: string]: any;
  sync: Function;
}

const connect_observer = (connectionTL: timeline) => {

  const intervalTL = T(
    (self: timeline) => {
      const f = () => (self[now] = true);
      setInterval(f, 1000);
    }
  );

  const infoTL = T();

  const changeTextTL = T(
    (self: timeline) =>
      (vscode.workspace
        .onDidChangeTextDocument(
          (info: object) => {
            self[now] = true;
          })
      )
  );


  const pathTL = T();

  const changeSelectionTL = T(
    (self: timeline) =>
      (vscode.window
        .onDidChangeTextEditorSelection(
          (info: object) => {

            pathTL[now] = (vscode.window
              .activeTextEditor === undefined)
              ? undefined
              : vscode.window
                .activeTextEditor
                .document.uri.fsPath;

            const dir_name =
              (pathTL[now] === undefined)
                ? undefined
                : ((path.extname(pathTL[now]) === ".adoc")
                  || (path.extname(pathTL[now]) === ".asciidoc"))

                  ? {
                    dir: path.dirname(pathTL[now]),
                    name: path.basename(pathTL[now])
                  }
                  : undefined;

            (dir_name === undefined)
              ? undefined
              : ((infoTL[now] = info) &&
                (self[now] = dir_name));
          })
      )
  );

  const changeTL = T(
    (self: timeline) => {
      changeTextTL
        .sync(() => self[now] = true);
      changeSelectionTL
        .sync(() => self[now] = true);
    }
  );
  // Get the current text editor
  const textTL = T(
    (self: timeline) => allTL
      ([changeTL,
        intervalTL])
      .sync(() => vscode.window.activeTextEditor)
      .sync((editor: vscode.TextEditor) =>
        editor.document)
      .sync((doc: vscode.TextDocument) =>
        doc.getText())
      .sync((docContent: String) =>
        (self[now] = docContent))
  );

  const socketTL = ((connectionTL: timeline) =>
    T(
      (self: timeline) => self
        .sync((obj: object) => {

          (connectionTL[now]
            === undefined)
            ? undefined
            : (connectionTL[now])
              .send({
                cmd: "event",
                data: obj
              });
        })
    )
  )(connectionTL);

  const noneTL = textTL
    .sync(
      () => (socketTL[now] = {
        text: textTL[now],
        dir_name: changeSelectionTL[now],
        line: infoTL[now]
          .selections[0]
          .active
          .line,
        lines: infoTL[now]
          .textEditor
          .document
          .lineCount
      })
    );

  return true;
};

export { connect_observer };



