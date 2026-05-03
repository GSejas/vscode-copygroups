/**
 * Logger Utility
 */

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | null = null;

export function getLogger(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Copy Groups');
  }
  return outputChannel;
}

export function log(message: string): void {
  const logger = getLogger();
  const timestamp = new Date().toISOString();
  logger.appendLine(`[${timestamp}] ${message}`);
}

export function error(message: string, err?: any): void {
  const logger = getLogger();
  const timestamp = new Date().toISOString();
  logger.appendLine(`[${timestamp}] ERROR: ${message}`);
  if (err) {
    logger.appendLine(String(err));
  }
}

export function info(message: string): void {
  log(`INFO: ${message}`);
}

export function debug(message: string): void {
  log(`DEBUG: ${message}`);
}
