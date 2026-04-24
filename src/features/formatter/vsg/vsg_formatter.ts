
// general imports
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class VsgFormatterDocumentFormattingEditProvider
    implements vscode.DocumentFormattingEditProvider
{
    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        _options: vscode.FormattingOptions,
        _token: vscode.CancellationToken
    ): Promise<vscode.TextEdit[]> {
        return new Promise<vscode.TextEdit[]>((resolve, reject) => {
            const config = vscode.workspace.getConfiguration('vhdl-by-hgb.vsg');
            const executable = config.get<string>('executable', 'vsg');
            const configFile = config.get<string>('configFile', '');

            const tmpFile = path.join(os.tmpdir(), `vsg_format_${Date.now()}.vhd`);
            fs.writeFileSync(tmpFile, document.getText());

            const args: string[] = ['-f', tmpFile, '--fix'];
            if (configFile && configFile.trim()) {
                args.push('--configuration', configFile.trim());
            }

            const child = cp.spawn(executable, args);
            let stderr = '';
            child.stderr.on('data', (chunk) => { stderr += chunk; });

            child.on('error', (err: NodeJS.ErrnoException) => {
                try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
                if (err.code === 'ENOENT') {
                    vscode.window.showErrorMessage(
                        `VSG executable '${executable}' not found. Install it with 'pip install vsg' and configure 'vhdl-by-hgb.vsg.executable' if needed.`
                    );
                    return resolve([]);
                }
                return reject(err);
            });

            child.on('close', () => {
                try {
                    const formatted = fs.readFileSync(tmpFile, 'utf8');
                    fs.unlinkSync(tmpFile);

                    if (formatted === document.getText()) {
                        return resolve([]);
                    }

                    const start = document.lineAt(0).range.start;
                    const end = document.lineAt(document.lineCount - 1).range.end;
                    return resolve([vscode.TextEdit.replace(new vscode.Range(start, end), formatted)]);
                } catch (e) {
                    try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
                    return reject(e);
                }
            });
        });
    }
}
