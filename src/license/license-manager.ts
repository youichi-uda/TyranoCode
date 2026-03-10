/**
 * License key validation for TyranoCode Pro features.
 * License keys are sold via Gumroad.
 *
 * Key format: TDEV-XXXX-XXXX-XXXX-XXXX
 * Validation: HMAC-SHA256 checksum (last 4 chars = checksum of first 12 data chars).
 * This is a simple offline check — the code is public and the validation is intentionally
 * transparent. We rely on the goodwill of the community rather than heavy DRM.
 *
 * Free features: syntax highlighting, completion, hover, diagnostics, variable watch, tag tracking
 * Pro features: debugger, flow graph, auto-test, profiler, refactoring
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';

export type Feature =
  | 'debugger'
  | 'flow-graph'
  | 'auto-test'
  | 'profiler'
  | 'refactoring';

const PRO_FEATURES: Feature[] = [
  'debugger',
  'flow-graph',
  'auto-test',
  'profiler',
  'refactoring',
];

// Verification salt — in production, this would use asymmetric signing
const VERIFICATION_SALT = 'tyranodev-pro-2024';

export class LicenseManager {
  private _isValid: boolean = false;
  private _licenseKey: string = '';
  private _onDidChange = new vscode.EventEmitter<boolean>();

  readonly onDidChange = this._onDidChange.event;

  get isProLicensed(): boolean {
    return this._isValid;
  }

  /**
   * Initialize license from stored settings.
   */
  initialize(): void {
    const config = vscode.workspace.getConfiguration('tyranodev');
    const key = config.get<string>('license.key', '');
    if (key) {
      this.validateAndSet(key);
    }
  }

  /**
   * Check if a specific Pro feature is available.
   */
  hasFeature(feature: Feature): boolean {
    return this._isValid;
  }

  /**
   * Validate and activate a license key.
   */
  async activateLicense(): Promise<void> {
    const key = await vscode.window.showInputBox({
      title: vscode.l10n.t('TyranoCode Pro License Key'),
      prompt: vscode.l10n.t('Enter your Gumroad license key (format: TDEV-XXXX-XXXX-XXXX-XXXX)'),
      placeHolder: 'TDEV-XXXX-XXXX-XXXX-XXXX',
      validateInput: (value) => {
        if (!value) return vscode.l10n.t('Please enter a license key');
        if (!/^TDEV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value)) {
          return vscode.l10n.t('Invalid format. Expected: TDEV-XXXX-XXXX-XXXX-XXXX');
        }
        return null;
      },
    });

    if (!key) return;

    if (this.validateAndSet(key)) {
      const config = vscode.workspace.getConfiguration('tyranodev');
      await config.update('license.key', key, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        vscode.l10n.t('TyranoCode Pro activated! All Pro features are now available.')
      );
    } else {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Invalid license key. Please check your key and try again.')
      );
    }
  }

  /**
   * Require Pro license for a feature. Shows activation prompt if not licensed.
   */
  async requirePro(feature: Feature): Promise<boolean> {
    if (this._isValid) return true;

    const featureNames: Record<Feature, string> = {
      'debugger': vscode.l10n.t('Debugger'),
      'flow-graph': vscode.l10n.t('Scenario Flow Graph'),
      'auto-test': vscode.l10n.t('Auto-Test'),
      'profiler': vscode.l10n.t('Performance Profiler'),
      'refactoring': vscode.l10n.t('Refactoring Tools'),
    };

    const enterKey = vscode.l10n.t('Enter License Key');
    const purchase = vscode.l10n.t('Purchase on Gumroad');

    const result = await vscode.window.showWarningMessage(
      vscode.l10n.t('{0} is a TyranoCode Pro feature. Purchase a license on Gumroad to unlock it.', featureNames[feature]),
      enterKey,
      purchase,
    );

    if (result === enterKey) {
      await this.activateLicense();
      return this._isValid;
    }

    if (result === purchase) {
      vscode.env.openExternal(vscode.Uri.parse('https://tyranocode.gumroad.com/'));
    }

    return false;
  }

  private validateAndSet(key: string): boolean {
    this._isValid = this.validateKey(key);
    this._licenseKey = key;
    this._onDidChange.fire(this._isValid);
    return this._isValid;
  }

  /**
   * Validate license key integrity.
   *
   * Key format: TDEV-[DATA]-[DATA]-[DATA]-[CHECK]
   * The last segment is a checksum of the first three data segments.
   */
  private validateKey(key: string): boolean {
    const match = key.match(/^TDEV-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
    if (!match) return false;

    const [, seg1, seg2, seg3, checksum] = match;
    const data = `${seg1}${seg2}${seg3}`;
    const expected = this.computeChecksum(data);

    return checksum === expected;
  }

  private computeChecksum(data: string): string {
    const hash = crypto.createHmac('sha256', VERIFICATION_SALT)
      .update(data)
      .digest('hex')
      .toUpperCase();
    return hash.substring(0, 4);
  }

  /**
   * Generate a valid license key (for internal use / key generation tool).
   */
  static generateKey(): string {
    const segments = Array.from({ length: 3 }, () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    });

    const data = segments.join('');
    const hash = crypto.createHmac('sha256', VERIFICATION_SALT)
      .update(data)
      .digest('hex')
      .toUpperCase();
    const checksum = hash.substring(0, 4);

    return `TDEV-${segments[0]}-${segments[1]}-${segments[2]}-${checksum}`;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
