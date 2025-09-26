import axios from 'axios';

export interface WeChatConfig {
  appId: string;
  appSecret: string;
}

export interface WeChatAuthResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface WeChatUserInfo {
  openid: string;
  unionid?: string;
  nickname?: string;
  headimgurl?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  privilege?: string[];
  errcode?: number;
  errmsg?: string;
}

export class WeChatService {
  private config: WeChatConfig;

  constructor(config: WeChatConfig) {
    this.config = config;
  }

  /**
   * Exchange authorization code for access token and openid
   */
  async getAccessToken(code: string): Promise<WeChatAuthResponse> {
    const url = 'https://api.weixin.qq.com/sns/oauth2/access_token';
    const params = {
      appid: this.config.appId,
      secret: this.config.appSecret,
      code: code,
      grant_type: 'authorization_code'
    };

    try {
      const response = await axios.get(url, { params });
      return response.data as WeChatAuthResponse;
    } catch (error) {
      throw new Error(`WeChat API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user info using access token and openid
   */
  async getUserInfo(accessToken: string, openid: string): Promise<WeChatUserInfo> {
    const url = 'https://api.weixin.qq.com/sns/userinfo';
    const params = {
      access_token: accessToken,
      openid: openid,
      lang: 'zh_CN'
    };

    try {
      const response = await axios.get(url, { params });
      return response.data as WeChatUserInfo;
    } catch (error) {
      throw new Error(`WeChat API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate WeChat signature (for security)
   */
  static validateSignature(signature: string, rawData: string, sessionKey: string): boolean {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha1');
    hash.update(rawData + sessionKey);
    const calculatedSignature = hash.digest('hex');
    return signature === calculatedSignature;
  }

  /**
   * Decrypt encrypted WeChat data
   */
  static decryptData(encryptedData: string, iv: string, sessionKey: string): any {
    const crypto = require('crypto');

    // Base64 decode
    const encrypted = Buffer.from(encryptedData, 'base64');
    const key = Buffer.from(sessionKey, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}

export const createWeChatService = (): WeChatService | null => {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    return null;
  }

  return new WeChatService({ appId, appSecret });
};