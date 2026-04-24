import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const DIAGNOSTIC_SOURCE = 'vsg';

// VSG --output syntastic format: filename:line:col:SEVERITY:rule_name
const SYNTASTIC_PATTERN = /^.+:(\d+):(\d+):(ERROR|WARNING|error|warning):(.+)$/;

export class VsgLinter {

    private mDiagnosticCollection: vscode.DiagnosticCollection;
    private mContext: vscode.ExtensionContext;
    private mOutputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.mContext = context;
        this.mOutputChannel = outputChannel;
        this.mDiagnosticCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
        context.subscriptions.push(this.mDiagnosticCollection);

        this.registerListeners();

        for (const doc of vscode.workspace.textDocuments) {
            if (doc.languageId === 'vhdl') {
                this.lintDocument(doc);
            }
        }
    }

    private registerListeners(): void {
        vscode.workspace.onDidOpenTextDocument(
            (doc) => { if (doc.languageId === 'vhdl') { this.lintDocument(doc); } },
            null,
            this.mContext.subscriptions
        );

        vscode.workspace.onDidSaveTextDocument(
            (doc) => { if (doc.languageId === 'vhdl') { this.lintDocument(doc); } },
            null,
            this.mContext.subscriptions
        );

        vscode.workspace.onDidCloseTextDocument(
            (doc) => { this.mDiagnosticCollection.delete(doc.uri); },
            null,
            this.mContext.subscriptions
        );

        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (event.affectsConfiguration('vhdl-by-hgb.vsg')) {
                    this.relintAll();
                }
            },
            null,
            this.mContext.subscriptions
        );
    }

    private relintAll(): void {
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.languageId === 'vhdl') {
                this.lintDocument(doc);
            }
        }
    }

    private async lintDocument(document: vscode.TextDocument): Promise<void> {
        const config = vscode.workspace.getConfiguration('vhdl-by-hgb.vsg');

        if (!config.get<boolean>('linting.enable', true)) {
            this.mDiagnosticCollection.delete(document.uri);
            return;
        }

        const executable = config.get<string>('executable', 'vsg');
        const configFile = config.get<string>('configFile', '');

        const tmpFile = path.join(os.tmpdir(), `vsg_lint_${Date.now()}.vhd`);
        fs.writeFileSync(tmpFile, document.getText());

        const args: string[] = ['-f', tmpFile, '--output', 'syntastic'];
        if (configFile && configFile.trim()) {
            args.push('--configuration', configFile.trim());
        }

        try {
            const output = await this.runVsg(executable, args);
            const diagnostics = this.parseSyntasticOutput(output);
            this.mDiagnosticCollection.set(document.uri, diagnostics);
        } catch (err) {
            this.mOutputChannel.appendLine(`VSG linting error: ${err}`);
        } finally {
            try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ }
        }
    }

    private runVsg(executable: string, args: string[]): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const child = cp.spawn(executable, args);
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk; });

            child.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ENOENT') {
                    vscode.window.showErrorMessage(
                        `VSG executable '${executable}' not found. Install it with 'pip install vsg' and configure 'vhdl-by-hgb.vsg.executable' if needed.`
                    );
                    return resolve('');
                }
                return reject(err);
            });

            // VSG exits with a non-zero code when violations are found — that is expected
            child.on('close', () => resolve(stdout + stderr));
        });
    }

    private parseSyntasticOutput(output: string): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        for (const line of output.split('\n')) {
            const match = line.match(SYNTASTIC_PATTERN);
            if (!match) { continue; }

            const lineNum = Math.max(parseInt(match[1], 10) - 1, 0);
            const colNum  = Math.max(parseInt(match[2], 10) - 1, 0);
            const severity = match[3].toUpperCase();
            const ruleName = match[4].trim();

            const range = new vscode.Range(lineNum, colNum, lineNum, Number.MAX_SAFE_INTEGER);
            const diagSeverity = severity === 'ERROR'
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning;

            const diag = new vscode.Diagnostic(range, ruleName, diagSeverity);
            diag.source = DIAGNOSTIC_SOURCE;
            diagnostics.push(diag);
        }

        return diagnostics;
    }
}
