#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import fs from "fs";
import { TokenManager } from "./token-manager.js";

// ESモジュールで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数を読み込み（プロジェクトルートの.envを明示的に指定）
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// トークンマネージャーのインスタンス
const tokenManager = new TokenManager();

/**
 * Meta Ads アクセストークンを取得
 * 優先順位: 1. TokenManager 2. 環境変数
 */
function getMetaAccessToken(): string {
  const token = tokenManager.getMetaAdsToken() || process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "META_ACCESS_TOKENが設定されていません。\n" +
      "方法1: .envファイルにMETA_ACCESS_TOKENを設定\n" +
      "方法2: http://localhost:3456 でOAuth認証を実行"
    );
  }
  return token;
}

/**
 * Google Ads 認証情報を取得
 * 優先順位: 1. TokenManager 2. 環境変数
 */
function getGoogleAdsCredentials() {
  const tokenData = tokenManager.getGoogleAdsToken();

  if (tokenData) {
    return {
      refresh_token: tokenData.refresh_token,
      client_id: tokenData.client_id,
      client_secret: tokenData.client_secret,
      developer_token: tokenData.developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN
    };
  }

  // フォールバック: 環境変数から取得
  const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const client_id = process.env.GOOGLE_ADS_CLIENT_ID;
  const client_secret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!refresh_token || !client_id || !client_secret) {
    throw new Error(
      "Google Ads認証情報が設定されていません。\n" +
      "方法1: .envファイルに以下を設定\n" +
      "  - GOOGLE_ADS_REFRESH_TOKEN\n" +
      "  - GOOGLE_ADS_CLIENT_ID\n" +
      "  - GOOGLE_ADS_CLIENT_SECRET\n" +
      "  - GOOGLE_ADS_DEVELOPER_TOKEN\n" +
      "方法2: http://localhost:3456 でOAuth認証を実行"
    );
  }

  return { refresh_token, client_id, client_secret, developer_token };
}

// MCPサーバーのインスタンスを作成
const server = new Server(
  {
    name: "my-ads-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 利用可能なツールのリスト
const tools: Tool[] = [
  {
    name: "list_meta_ad_accounts",
    description: "Meta広告アカウントの一覧を取得します",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_meta_campaign_insights",
    description: "Meta広告キャンペーンのパフォーマンスデータを取得します",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d, last_90d）",
        },
        time_range: {
          type: "string",
          description: "カスタム期間（JSON形式: {\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}）",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "get_meta_adset_insights",
    description: "Meta広告セット（Ad Set）のパフォーマンスデータを取得します",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d, last_90d）",
        },
        time_range: {
          type: "string",
          description: "カスタム期間（JSON形式: {\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}）",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "get_meta_ad_insights",
    description: "Meta広告（Ad）のパフォーマンスデータを取得します",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d, last_90d）",
        },
        time_range: {
          type: "string",
          description: "カスタム期間（JSON形式: {\"since\":\"YYYY-MM-DD\",\"until\":\"YYYY-MM-DD\"}）",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "compare_meta_campaign_periods",
    description: "Meta広告キャンペーンの2つの期間を比較して成長率を分析します",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        period1_start: {
          type: "string",
          description: "期間1の開始日（YYYY-MM-DD）",
        },
        period1_end: {
          type: "string",
          description: "期間1の終了日（YYYY-MM-DD）",
        },
        period2_start: {
          type: "string",
          description: "期間2の開始日（YYYY-MM-DD）",
        },
        period2_end: {
          type: "string",
          description: "期間2の終了日（YYYY-MM-DD）",
        },
        level: {
          type: "string",
          description: "分析レベル（campaign, adset, ad）",
          default: "campaign",
        },
      },
      required: ["account_id", "period1_start", "period1_end", "period2_start", "period2_end"],
    },
  },
  {
    name: "get_meta_top_performers",
    description: "Meta広告の最も成果を上げているキャンペーン/広告セット/広告を取得します",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        level: {
          type: "string",
          description: "分析レベル（campaign, adset, ad）",
          default: "campaign",
        },
        metric: {
          type: "string",
          description: "ソート基準（spend, roas, ctr, cpc, conversions）",
          default: "spend",
        },
        limit: {
          type: "number",
          description: "取得する件数（デフォルト: 10）",
          default: 10,
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d）",
          default: "last_30d",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "analyze_meta_performance",
    description: "Meta広告アカウント全体のパフォーマンスを分析します（ROI/ROAS計算を含む）",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d）",
          default: "last_30d",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "export_meta_data_to_csv",
    description: "Meta広告データをCSVファイルにエクスポートします",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description: "エクスポートするJSONデータ（文字列形式）",
        },
        data_type: {
          type: "string",
          description: "データタイプ（campaigns, adsets, ads, comparison, top_performers, analysis）",
        },
        filename: {
          type: "string",
          description: "出力ファイル名（省略可、デフォルト: meta_data_YYYYMMDD_HHMMSS.csv）",
        },
      },
      required: ["data", "data_type"],
    },
  },
  {
    name: "generate_meta_client_report",
    description: "Meta広告の総合レポートを生成します（お客様向け資料形式、サマリー・分析・推奨アクションを含む）",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        period_days: {
          type: "number",
          description: "分析期間（日数、デフォルト: 30）",
          default: 30,
        },
        report_title: {
          type: "string",
          description: "レポートタイトル（省略可）",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "debug_meta_api_response",
    description: "Meta APIから返される生データを確認するデバッグツール（数値の検証用）",
    inputSchema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "広告アカウントID（例: act_123456789）",
        },
        date_preset: {
          type: "string",
          description: "期間プリセット（例: last_7d, last_30d）",
          default: "last_30d",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "list_google_ad_accounts",
    description: "Google広告アカウントの一覧を取得します",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_google_campaign_performance",
    description: "Google広告キャンペーンのパフォーマンスデータを取得します",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "顧客ID（例: 1234567890）",
        },
        start_date: {
          type: "string",
          description: "開始日（YYYY-MM-DD形式）",
        },
        end_date: {
          type: "string",
          description: "終了日（YYYY-MM-DD形式）",
        },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "get_google_ad_creatives",
    description: "Google広告のクリエイティブ情報（見出し、説明文、URL等）を取得します",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "顧客ID（例: 1234567890）",
        },
        campaign_id: {
          type: "string",
          description: "キャンペーンIDでフィルタ（省略可）",
        },
        ad_status: {
          type: "string",
          description: "広告ステータスでフィルタ（ENABLED, PAUSED, REMOVED）。デフォルト: ENABLEDとPAUSED",
        },
      },
      required: ["customer_id"],
    },
  },
  // ========== GA4 Analytics Tools ==========
  {
    name: "list_ga4_properties",
    description: "GA4プロパティの一覧を取得します。アカウント名・プロパティ名・プロパティIDを返します",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_ga4_report",
    description: "GA4のカスタムレポートを取得します。ディメンションとメトリクスを自由に指定できます",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        dimensions: {
          type: "string",
          description: "ディメンション（カンマ区切り。例: date,sessionSource,pagePath）",
        },
        metrics: {
          type: "string",
          description: "メトリクス（カンマ区切り。例: sessions,totalUsers,screenPageViews,conversions）",
        },
        start_date: {
          type: "string",
          description: "開始日（YYYY-MM-DD形式、またはNdaysAgo, today, yesterday）",
        },
        end_date: {
          type: "string",
          description: "終了日（YYYY-MM-DD形式、またはtoday, yesterday）",
        },
        limit: {
          type: "number",
          description: "取得件数（デフォルト: 100）",
        },
        dimension_filter: {
          type: "string",
          description: "ディメンションフィルタ（JSON形式。例: {\"fieldName\":\"pagePath\",\"stringFilter\":{\"matchType\":\"CONTAINS\",\"value\":\"/blog\"}}）",
        },
        order_by: {
          type: "string",
          description: "ソート対象のメトリクス名（例: sessions）。降順でソート",
        },
      },
      required: ["property_id", "metrics"],
    },
  },
  {
    name: "get_ga4_realtime",
    description: "GA4のリアルタイムデータを取得します（過去30分のアクティブユーザー等）",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        dimensions: {
          type: "string",
          description: "ディメンション（カンマ区切り。例: unifiedScreenName,country,deviceCategory）",
        },
        metrics: {
          type: "string",
          description: "メトリクス（カンマ区切り。デフォルト: activeUsers）",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "get_ga4_traffic_sources",
    description: "GA4の流入元（トラフィックソース）分析を行います。チャネル別・参照元別・キャンペーン別のデータを取得します",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        start_date: {
          type: "string",
          description: "開始日（YYYY-MM-DD形式、またはNdaysAgo）。デフォルト: 30daysAgo",
        },
        end_date: {
          type: "string",
          description: "終了日。デフォルト: yesterday",
        },
        breakdown: {
          type: "string",
          description: "分析軸（channel: デフォルトチャネル, source_medium: 参照元/メディア, campaign: キャンペーン）。デフォルト: source_medium",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "get_ga4_page_performance",
    description: "GA4のページ別パフォーマンスを取得します。PV数、ユーザー数、滞在時間、直帰率等",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        start_date: {
          type: "string",
          description: "開始日。デフォルト: 30daysAgo",
        },
        end_date: {
          type: "string",
          description: "終了日。デフォルト: yesterday",
        },
        page_path_filter: {
          type: "string",
          description: "ページパスでフィルタ（部分一致。例: /blog）",
        },
        limit: {
          type: "number",
          description: "取得件数（デフォルト: 50）",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "get_ga4_conversions",
    description: "GA4のコンバージョン（キーイベント）データを取得します。イベント別・流入元別のコンバージョン分析",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        start_date: {
          type: "string",
          description: "開始日。デフォルト: 30daysAgo",
        },
        end_date: {
          type: "string",
          description: "終了日。デフォルト: yesterday",
        },
        event_name: {
          type: "string",
          description: "特定のイベント名でフィルタ（例: purchase, generate_lead）",
        },
        breakdown: {
          type: "string",
          description: "分析軸（source_medium: 流入元別, page: ページ別, event: イベント別）。デフォルト: event",
        },
      },
      required: ["property_id"],
    },
  },
  {
    name: "get_ga4_user_demographics",
    description: "GA4のユーザー属性データを取得します（国、デバイス、ブラウザ等）",
    inputSchema: {
      type: "object",
      properties: {
        property_id: {
          type: "string",
          description: "GA4プロパティID（例: 123456789）",
        },
        start_date: {
          type: "string",
          description: "開始日。デフォルト: 30daysAgo",
        },
        end_date: {
          type: "string",
          description: "終了日。デフォルト: yesterday",
        },
        dimension_type: {
          type: "string",
          description: "属性タイプ（country: 国, city: 都市, device: デバイス, browser: ブラウザ, os: OS, language: 言語）。デフォルト: device",
        },
      },
      required: ["property_id"],
    },
  },
];

// ツールリストのハンドラー
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// ツール実行のハンドラー
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_meta_ad_accounts":
        return await handleListMetaAdAccounts();

      case "get_meta_campaign_insights":
        return await handleGetMetaCampaignInsights(args);

      case "get_meta_adset_insights":
        return await handleGetMetaAdsetInsights(args);

      case "get_meta_ad_insights":
        return await handleGetMetaAdInsights(args);

      case "compare_meta_campaign_periods":
        return await handleCompareMetaCampaignPeriods(args);

      case "get_meta_top_performers":
        return await handleGetMetaTopPerformers(args);

      case "analyze_meta_performance":
        return await handleAnalyzeMetaPerformance(args);

      case "export_meta_data_to_csv":
        return await handleExportMetaDataToCsv(args);

      case "generate_meta_client_report":
        return await handleGenerateMetaClientReport(args);

      case "debug_meta_api_response":
        return await handleDebugMetaApiResponse(args);

      case "list_google_ad_accounts":
        return await handleListGoogleAdAccounts();

      case "get_google_campaign_performance":
        return await handleGetGoogleCampaignPerformance(args);

      case "get_google_ad_creatives":
        return await handleGetGoogleAdCreatives(args);

      // GA4 Analytics
      case "list_ga4_properties":
        return await handleListGa4Properties();

      case "get_ga4_report":
        return await handleGetGa4Report(args);

      case "get_ga4_realtime":
        return await handleGetGa4Realtime(args);

      case "get_ga4_traffic_sources":
        return await handleGetGa4TrafficSources(args);

      case "get_ga4_page_performance":
        return await handleGetGa4PagePerformance(args);

      case "get_ga4_conversions":
        return await handleGetGa4Conversions(args);

      case "get_ga4_user_demographics":
        return await handleGetGa4UserDemographics(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `エラーが発生しました: ${errorMessage}`,
        },
      ],
    };
  }
});

// Meta広告アカウント一覧取得
async function handleListMetaAdAccounts() {
  const accessToken = getMetaAccessToken();

  try {
    // Meta Graph APIを使用してアカウント一覧を取得
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/me/adaccounts`,
      {
        params: {
          access_token: accessToken,
          fields: "id,name,account_status,currency,balance,amount_spent,spend_cap",
        },
      }
    );

    const accounts = response.data.data || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            count: accounts.length,
            accounts: accounts.map((account: any) => ({
              id: account.id,
              name: account.name,
              status: account.account_status,
              currency: account.currency,
              balance: account.balance,
              spent: account.amount_spent,
              spend_cap: account.spend_cap,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Metaキャンペーンインサイト取得
async function handleGetMetaCampaignInsights(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, date_preset, time_range } = args;

  try {
    const params: any = {
      access_token: accessToken,
      level: "campaign",
      fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,conversions,cost_per_action_type,purchase_roas",
    };

    // date_preset または time_range を使用
    if (time_range) {
      params.time_range = time_range;
    } else {
      params.date_preset = date_preset || "last_30d";
    }

    // Meta Graph APIを使用してインサイトを取得
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      { params }
    );

    const insights = response.data.data || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            period: time_range || date_preset || "last_30d",
            count: insights.length,
            campaigns: insights.map((campaign: any) => ({
              id: campaign.campaign_id,
              name: campaign.campaign_name,
              impressions: campaign.impressions,
              clicks: campaign.clicks,
              spend: campaign.spend,
              ctr: campaign.ctr,
              cpc: campaign.cpc,
              cpm: campaign.cpm,
              reach: campaign.reach,
              frequency: campaign.frequency,
              conversions: campaign.conversions,
              actions: campaign.actions,
              action_values: campaign.action_values,
              purchase_roas: campaign.purchase_roas,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Meta広告セットインサイト取得
async function handleGetMetaAdsetInsights(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, date_preset, time_range } = args;

  try {
    const params: any = {
      access_token: accessToken,
      level: "adset",
      fields: "adset_id,adset_name,campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,conversions,cost_per_action_type,purchase_roas",
    };

    if (time_range) {
      params.time_range = time_range;
    } else {
      params.date_preset = date_preset || "last_30d";
    }

    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      { params }
    );

    const insights = response.data.data || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            period: time_range || date_preset || "last_30d",
            count: insights.length,
            adsets: insights.map((adset: any) => ({
              id: adset.adset_id,
              name: adset.adset_name,
              campaign_id: adset.campaign_id,
              campaign_name: adset.campaign_name,
              impressions: adset.impressions,
              clicks: adset.clicks,
              spend: adset.spend,
              ctr: adset.ctr,
              cpc: adset.cpc,
              cpm: adset.cpm,
              reach: adset.reach,
              frequency: adset.frequency,
              conversions: adset.conversions,
              actions: adset.actions,
              action_values: adset.action_values,
              purchase_roas: adset.purchase_roas,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Meta広告インサイト取得
async function handleGetMetaAdInsights(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, date_preset, time_range } = args;

  try {
    const params: any = {
      access_token: accessToken,
      level: "ad",
      fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values,conversions,cost_per_action_type,purchase_roas",
    };

    if (time_range) {
      params.time_range = time_range;
    } else {
      params.date_preset = date_preset || "last_30d";
    }

    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      { params }
    );

    const insights = response.data.data || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            period: time_range || date_preset || "last_30d",
            count: insights.length,
            ads: insights.map((ad: any) => ({
              id: ad.ad_id,
              name: ad.ad_name,
              adset_id: ad.adset_id,
              adset_name: ad.adset_name,
              campaign_id: ad.campaign_id,
              campaign_name: ad.campaign_name,
              impressions: ad.impressions,
              clicks: ad.clicks,
              spend: ad.spend,
              ctr: ad.ctr,
              cpc: ad.cpc,
              cpm: ad.cpm,
              reach: ad.reach,
              frequency: ad.frequency,
              conversions: ad.conversions,
              actions: ad.actions,
              action_values: ad.action_values,
              purchase_roas: ad.purchase_roas,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Meta期間比較分析
async function handleCompareMetaCampaignPeriods(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, period1_start, period1_end, period2_start, period2_end, level = "campaign" } = args;

  try {
    // 期間1のデータ取得
    const period1Response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: level,
          time_range: JSON.stringify({ since: period1_start, until: period1_end }),
          fields: `${level}_id,${level}_name,impressions,clicks,spend,ctr,cpc,cpm,reach,conversions,purchase_roas`,
        },
      }
    );

    // 期間2のデータ取得
    const period2Response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: level,
          time_range: JSON.stringify({ since: period2_start, until: period2_end }),
          fields: `${level}_id,${level}_name,impressions,clicks,spend,ctr,cpc,cpm,reach,conversions,purchase_roas`,
        },
      }
    );

    const period1Data = period1Response.data.data || [];
    const period2Data = period2Response.data.data || [];

    // データを統合して比較
    const comparison = period1Data.map((item1: any) => {
      const idField = `${level}_id`;
      const nameField = `${level}_name`;
      const item2 = period2Data.find((i: any) => i[idField] === item1[idField]);

      if (!item2) return null;

      const calculateChange = (val1: number, val2: number) => {
        if (!val1) return 0;
        return ((val2 - val1) / val1) * 100;
      };

      return {
        id: item1[idField],
        name: item1[nameField],
        period1: {
          impressions: parseInt(item1.impressions || 0),
          clicks: parseInt(item1.clicks || 0),
          spend: parseFloat(item1.spend || 0),
          ctr: parseFloat(item1.ctr || 0),
          cpc: parseFloat(item1.cpc || 0),
          conversions: parseInt(item1.conversions || 0),
          roas: parseFloat(item1.purchase_roas?.[0]?.value || 0),
        },
        period2: {
          impressions: parseInt(item2.impressions || 0),
          clicks: parseInt(item2.clicks || 0),
          spend: parseFloat(item2.spend || 0),
          ctr: parseFloat(item2.ctr || 0),
          cpc: parseFloat(item2.cpc || 0),
          conversions: parseInt(item2.conversions || 0),
          roas: parseFloat(item2.purchase_roas?.[0]?.value || 0),
        },
        changes: {
          impressions_change: calculateChange(parseInt(item1.impressions || 0), parseInt(item2.impressions || 0)),
          clicks_change: calculateChange(parseInt(item1.clicks || 0), parseInt(item2.clicks || 0)),
          spend_change: calculateChange(parseFloat(item1.spend || 0), parseFloat(item2.spend || 0)),
          conversions_change: calculateChange(parseInt(item1.conversions || 0), parseInt(item2.conversions || 0)),
        },
      };
    }).filter((item: any) => item !== null);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            level,
            period1: `${period1_start} - ${period1_end}`,
            period2: `${period2_start} - ${period2_end}`,
            comparison,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Metaトップパフォーマー取得
async function handleGetMetaTopPerformers(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, level = "campaign", metric = "spend", limit = 10, date_preset = "last_30d" } = args;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: level,
          date_preset: date_preset,
          fields: `${level}_id,${level}_name,impressions,clicks,spend,ctr,cpc,cpm,conversions,purchase_roas`,
        },
      }
    );

    let data = response.data.data || [];

    // メトリクスでソート
    data.sort((a: any, b: any) => {
      let aVal = 0;
      let bVal = 0;

      if (metric === "roas") {
        aVal = parseFloat(a.purchase_roas?.[0]?.value || 0);
        bVal = parseFloat(b.purchase_roas?.[0]?.value || 0);
      } else {
        aVal = parseFloat(a[metric] || 0);
        bVal = parseFloat(b[metric] || 0);
      }

      return bVal - aVal; // 降順
    });

    // 上位N件を取得
    data = data.slice(0, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            level,
            metric,
            period: date_preset,
            count: data.length,
            top_performers: data.map((item: any) => ({
              id: item[`${level}_id`],
              name: item[`${level}_name`],
              impressions: item.impressions,
              clicks: item.clicks,
              spend: item.spend,
              ctr: item.ctr,
              cpc: item.cpc,
              conversions: item.conversions,
              roas: item.purchase_roas?.[0]?.value || 0,
            })),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Metaパフォーマンス分析
async function handleAnalyzeMetaPerformance(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, date_preset = "last_30d" } = args;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: "account",
          date_preset: date_preset,
          fields: "impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,conversions,actions,action_values,purchase_roas",
        },
      }
    );

    const data = response.data.data?.[0] || {};

    // 集計データの計算
    const totalSpend = parseFloat(data.spend || 0);
    const totalClicks = parseInt(data.clicks || 0);
    const totalImpressions = parseInt(data.impressions || 0);
    const totalConversions = parseInt(data.conversions || 0);
    const avgCtr = parseFloat(data.ctr || 0);
    const avgCpc = parseFloat(data.cpc || 0);
    const avgCpm = parseFloat(data.cpm || 0);
    const roas = parseFloat(data.purchase_roas?.[0]?.value || 0);

    // アクション値から収益を計算
    const revenue = data.action_values?.find((av: any) => av.action_type === "omni_purchase")?.value || 0;
    const totalRevenue = parseFloat(revenue);

    // ROI計算
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            account_id,
            period: date_preset,
            summary: {
              total_spend: totalSpend.toFixed(2),
              total_clicks: totalClicks,
              total_impressions: totalImpressions,
              total_conversions: totalConversions,
              total_revenue: totalRevenue.toFixed(2),
            },
            averages: {
              ctr: avgCtr.toFixed(2) + "%",
              cpc: avgCpc.toFixed(2),
              cpm: avgCpm.toFixed(2),
            },
            performance: {
              roas: roas.toFixed(2),
              roi: roi.toFixed(2) + "%",
              cost_per_conversion: totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : 0,
              conversion_rate: totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) + "%" : "0%",
            },
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// MetaデータをCSVにエクスポート
async function handleExportMetaDataToCsv(args: any) {
  const { data, data_type, filename } = args;

  try {
    // JSONデータをパース
    const parsedData = JSON.parse(data);

    // エクスポートディレクトリ（Downloadsフォルダ）
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const exportDir = path.join(homeDir, "Downloads");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // ファイル名の生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T");
    const dateStr = timestamp[0];
    const timeStr = timestamp[1].split("-")[0];
    const defaultFilename = `meta_${data_type}_${dateStr}_${timeStr}.csv`;
    const outputFilename = filename || defaultFilename;
    const outputPath = path.join(exportDir, outputFilename);

    // データタイプに応じてCSVを生成
    let csvContent = "";

    switch (data_type) {
      case "campaigns":
        csvContent = generateCampaignsCsv(parsedData);
        break;
      case "adsets":
        csvContent = generateAdsetsCsv(parsedData);
        break;
      case "ads":
        csvContent = generateAdsCsv(parsedData);
        break;
      case "comparison":
        csvContent = generateComparisonCsv(parsedData);
        break;
      case "top_performers":
        csvContent = generateTopPerformersCsv(parsedData);
        break;
      case "analysis":
        csvContent = generateAnalysisCsv(parsedData);
        break;
      default:
        throw new Error(`サポートされていないdata_type: ${data_type}`);
    }

    // ファイルに書き込み
    fs.writeFileSync(outputPath, csvContent, "utf-8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "CSVファイルを生成しました",
            file_path: outputPath,
            data_type,
            rows: csvContent.split("\n").length - 1,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(`CSV出力エラー: ${error.message}`);
  }
}

// キャンペーンデータのCSV生成
function generateCampaignsCsv(data: any): string {
  const campaigns = data.campaigns || [];

  // ヘッダー行
  const headers = [
    "Campaign ID",
    "Campaign Name",
    "Impressions",
    "Clicks",
    "Spend",
    "CTR",
    "CPC",
    "CPM",
    "Reach",
    "Frequency",
    "Conversions",
    "ROAS"
  ];

  // データ行
  const rows = campaigns.map((c: any) => {
    const roas = c.purchase_roas?.[0]?.value || c.purchase_roas || 0;
    return [
      c.id || "",
      `"${c.name || ""}"`,
      c.impressions || 0,
      c.clicks || 0,
      c.spend || 0,
      c.ctr || 0,
      c.cpc || 0,
      c.cpm || 0,
      c.reach || 0,
      c.frequency || 0,
      c.conversions || 0,
      roas
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// 広告セットデータのCSV生成
function generateAdsetsCsv(data: any): string {
  const adsets = data.adsets || [];

  const headers = [
    "AdSet ID",
    "AdSet Name",
    "Campaign ID",
    "Campaign Name",
    "Impressions",
    "Clicks",
    "Spend",
    "CTR",
    "CPC",
    "CPM",
    "Reach",
    "Frequency",
    "Conversions",
    "ROAS"
  ];

  const rows = adsets.map((a: any) => {
    const roas = a.purchase_roas?.[0]?.value || a.purchase_roas || 0;
    return [
      a.id || "",
      `"${a.name || ""}"`,
      a.campaign_id || "",
      `"${a.campaign_name || ""}"`,
      a.impressions || 0,
      a.clicks || 0,
      a.spend || 0,
      a.ctr || 0,
      a.cpc || 0,
      a.cpm || 0,
      a.reach || 0,
      a.frequency || 0,
      a.conversions || 0,
      roas
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// 広告データのCSV生成
function generateAdsCsv(data: any): string {
  const ads = data.ads || [];

  const headers = [
    "Ad ID",
    "Ad Name",
    "AdSet ID",
    "AdSet Name",
    "Campaign ID",
    "Campaign Name",
    "Impressions",
    "Clicks",
    "Spend",
    "CTR",
    "CPC",
    "CPM",
    "Reach",
    "Frequency",
    "Conversions",
    "ROAS"
  ];

  const rows = ads.map((a: any) => {
    const roas = a.purchase_roas?.[0]?.value || a.purchase_roas || 0;
    return [
      a.id || "",
      `"${a.name || ""}"`,
      a.adset_id || "",
      `"${a.adset_name || ""}"`,
      a.campaign_id || "",
      `"${a.campaign_name || ""}"`,
      a.impressions || 0,
      a.clicks || 0,
      a.spend || 0,
      a.ctr || 0,
      a.cpc || 0,
      a.cpm || 0,
      a.reach || 0,
      a.frequency || 0,
      a.conversions || 0,
      roas
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// 期間比較データのCSV生成
function generateComparisonCsv(data: any): string {
  const comparison = data.comparison || [];

  const headers = [
    "ID",
    "Name",
    "Period1 Impressions",
    "Period2 Impressions",
    "Impressions Change %",
    "Period1 Clicks",
    "Period2 Clicks",
    "Clicks Change %",
    "Period1 Spend",
    "Period2 Spend",
    "Spend Change %",
    "Period1 Conversions",
    "Period2 Conversions",
    "Conversions Change %"
  ];

  const rows = comparison.map((c: any) => {
    return [
      c.id || "",
      `"${c.name || ""}"`,
      c.period1?.impressions || 0,
      c.period2?.impressions || 0,
      (c.changes?.impressions_change || 0).toFixed(2),
      c.period1?.clicks || 0,
      c.period2?.clicks || 0,
      (c.changes?.clicks_change || 0).toFixed(2),
      c.period1?.spend || 0,
      c.period2?.spend || 0,
      (c.changes?.spend_change || 0).toFixed(2),
      c.period1?.conversions || 0,
      c.period2?.conversions || 0,
      (c.changes?.conversions_change || 0).toFixed(2)
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// トップパフォーマーデータのCSV生成
function generateTopPerformersCsv(data: any): string {
  const performers = data.top_performers || [];

  const headers = [
    "ID",
    "Name",
    "Impressions",
    "Clicks",
    "Spend",
    "CTR",
    "CPC",
    "Conversions",
    "ROAS"
  ];

  const rows = performers.map((p: any) => {
    return [
      p.id || "",
      `"${p.name || ""}"`,
      p.impressions || 0,
      p.clicks || 0,
      p.spend || 0,
      p.ctr || 0,
      p.cpc || 0,
      p.conversions || 0,
      p.roas || 0
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

// パフォーマンス分析データのCSV生成
function generateAnalysisCsv(data: any): string {
  const summary = data.summary || {};
  const averages = data.averages || {};
  const performance = data.performance || {};

  const headers = ["Metric", "Value"];
  const rows = [
    ["Total Spend", summary.total_spend || 0],
    ["Total Clicks", summary.total_clicks || 0],
    ["Total Impressions", summary.total_impressions || 0],
    ["Total Conversions", summary.total_conversions || 0],
    ["Total Revenue", summary.total_revenue || 0],
    ["Average CTR", averages.ctr || "0%"],
    ["Average CPC", averages.cpc || 0],
    ["Average CPM", averages.cpm || 0],
    ["ROAS", performance.roas || 0],
    ["ROI", performance.roi || "0%"],
    ["Cost Per Conversion", performance.cost_per_conversion || 0],
    ["Conversion Rate", performance.conversion_rate || "0%"]
  ];

  return [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");
}

// お客様向けレポート生成
async function handleGenerateMetaClientReport(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, period_days = 30, report_title } = args;

  try {
    // 期間の計算（Meta APIは3日遅れのデータなので、endDateを3日前に設定）
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // 3日前まで
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - period_days);

    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    // 1. アカウント全体のサマリーデータ取得
    const summaryResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: "account",
          time_range: JSON.stringify({ since: formatDate(startDate), until: formatDate(endDate) }),
          fields: "impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,conversions,action_values,purchase_roas",
        },
      }
    );

    // 2. 日毎のデータ取得
    const dailyResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: "account",
          time_range: JSON.stringify({ since: formatDate(startDate), until: formatDate(endDate) }),
          time_increment: 1, // 日毎
          fields: "date_start,impressions,clicks,spend,ctr,cpc,conversions,purchase_roas",
        },
      }
    );

    // 3. キャンペーン別データ取得
    const campaignResponse = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: "campaign",
          time_range: JSON.stringify({ since: formatDate(startDate), until: formatDate(endDate) }),
          fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,conversions,purchase_roas",
        },
      }
    );

    const summaryData = summaryResponse.data.data?.[0] || {};
    const dailyData = dailyResponse.data.data || [];
    const campaignData = campaignResponse.data.data || [];

    // データ分析
    const analysis = analyzePerformance(summaryData, dailyData, campaignData);

    // CSVレポート生成
    const csvContent = generateClientReportCsv({
      title: report_title || "Meta広告パフォーマンスレポート",
      period: `${formatDate(startDate)} 〜 ${formatDate(endDate)}`,
      summary: summaryData,
      daily: dailyData,
      campaigns: campaignData,
      analysis: analysis,
    });

    // ファイル保存
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const exportDir = path.join(homeDir, "Downloads");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
    const filename = `Meta広告レポート_${timestamp}.csv`;
    const outputPath = path.join(exportDir, filename);

    fs.writeFileSync(outputPath, "\uFEFF" + csvContent, "utf-8"); // BOM付きでExcel対応

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "クライアント向けレポートを生成しました",
            file_path: outputPath,
            period: `${formatDate(startDate)} 〜 ${formatDate(endDate)}`,
            summary: {
              total_spend: summaryData.spend || 0,
              total_clicks: summaryData.clicks || 0,
              total_conversions: summaryData.conversions || 0,
              avg_ctr: summaryData.ctr || 0,
              avg_cpc: summaryData.cpc || 0,
            },
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `レポート生成エラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// パフォーマンス分析
function analyzePerformance(summary: any, daily: any[], campaigns: any[]) {
  const totalSpend = parseFloat(summary.spend || 0);
  const totalClicks = parseInt(summary.clicks || 0);
  const totalConversions = parseInt(summary.conversions || 0);
  const avgCtr = parseFloat(summary.ctr || 0);
  const avgCpc = parseFloat(summary.cpc || 0);
  const roas = parseFloat(summary.purchase_roas?.[0]?.value || 0);

  // 懸念事項の抽出
  const concerns: string[] = [];

  if (avgCtr < 1.0) {
    concerns.push("CTRが低い（1%未満）- クリエイティブの改善が必要");
  }
  if (avgCpc > 500) {
    concerns.push("CPCが高い（500円以上）- ターゲティングの見直しを推奨");
  }
  if (totalConversions === 0) {
    concerns.push("コンバージョンが0件 - トラッキング設定の確認が必要");
  }
  if (roas < 1.0 && roas > 0) {
    concerns.push("ROASが1.0未満 - 広告費が売上を上回っています");
  }

  // 日毎のトレンド分析
  let trend = "安定";
  if (daily.length >= 7) {
    const recentWeek = daily.slice(-7);
    const previousWeek = daily.slice(-14, -7);

    if (recentWeek.length === 7 && previousWeek.length === 7) {
      const recentSpend = recentWeek.reduce((sum, d) => sum + parseFloat(d.spend || 0), 0);
      const previousSpend = previousWeek.reduce((sum, d) => sum + parseFloat(d.spend || 0), 0);

      const change = ((recentSpend - previousSpend) / previousSpend) * 100;

      if (change > 20) trend = "増加傾向";
      else if (change < -20) trend = "減少傾向";
    }
  }

  // トップパフォーマーの特定
  const sortedCampaigns = campaigns
    .map(c => ({
      name: c.campaign_name,
      spend: parseFloat(c.spend || 0),
      conversions: parseInt(c.conversions || 0),
      roas: parseFloat(c.purchase_roas?.[0]?.value || 0),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3);

  // 推奨アクション
  const recommendations: string[] = [];

  if (avgCtr < 1.0) {
    recommendations.push("クリエイティブのA/Bテストを実施し、CTR改善を図る");
  }
  if (totalSpend > 100000 && totalConversions < 10) {
    recommendations.push("コンバージョン単価が高いため、ターゲティングを絞り込む");
  }
  if (roas < 2.0 && roas > 0) {
    recommendations.push("ROASを2.0以上に改善するため、高ROASキャンペーンへ予算を集中");
  }
  if (sortedCampaigns.length > 0) {
    recommendations.push(`最も支出の多い「${sortedCampaigns[0].name}」の最適化を優先`);
  }
  if (concerns.length === 0) {
    recommendations.push("パフォーマンスは良好です。現在の戦略を継続しつつ、新規クリエイティブのテストを検討");
  }

  return {
    concerns,
    trend,
    topCampaigns: sortedCampaigns,
    recommendations,
  };
}

// クライアントレポートCSV生成
function generateClientReportCsv(data: any): string {
  const { title, period, summary, daily, campaigns, analysis } = data;

  const sections: string[] = [];

  // セクション1: レポートヘッダー
  sections.push("=== レポート情報 ===");
  sections.push(`タイトル,${title}`);
  sections.push(`対象期間,${period}`);
  sections.push(`作成日,${new Date().toLocaleDateString("ja-JP")}`);
  sections.push("");

  // セクション2: エグゼクティブサマリー
  sections.push("=== エグゼクティブサマリー ===");
  sections.push("指標,値");
  sections.push(`総広告費,¥${parseFloat(summary.spend || 0).toLocaleString()}`);
  sections.push(`総インプレッション数,${parseInt(summary.impressions || 0).toLocaleString()}`);
  sections.push(`総クリック数,${parseInt(summary.clicks || 0).toLocaleString()}`);
  sections.push(`総コンバージョン数,${parseInt(summary.conversions || 0).toLocaleString()}`);
  sections.push(`平均CTR,${parseFloat(summary.ctr || 0).toFixed(2)}%`);
  sections.push(`平均CPC,¥${parseFloat(summary.cpc || 0).toFixed(2)}`);
  sections.push(`平均CPM,¥${parseFloat(summary.cpm || 0).toFixed(2)}`);

  const revenue = summary.action_values?.find((av: any) => av.action_type === "omni_purchase")?.value || 0;
  const totalRevenue = parseFloat(revenue);
  const totalSpend = parseFloat(summary.spend || 0);
  const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
  const roas = parseFloat(summary.purchase_roas?.[0]?.value || 0);

  sections.push(`ROAS,${roas.toFixed(2)}`);
  sections.push(`ROI,${roi.toFixed(2)}%`);
  sections.push("");

  // セクション3: トレンド分析
  sections.push("=== トレンド分析 ===");
  sections.push(`全体トレンド,${analysis.trend}`);
  sections.push("");

  // セクション4: 日毎データ（週毎集計）
  sections.push("=== 週毎サマリー ===");
  sections.push("週,インプレッション,クリック,広告費,コンバージョン,CTR,CPC");

  // 週毎にデータを集計
  const weeklyData: any = {};
  daily.forEach((d: any) => {
    const date = new Date(d.date_start);
    const weekNum = Math.floor((date.getTime() - new Date(daily[0].date_start).getTime()) / (7 * 24 * 60 * 60 * 1000));

    if (!weeklyData[weekNum]) {
      weeklyData[weekNum] = {
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
      };
    }

    weeklyData[weekNum].impressions += parseInt(d.impressions || 0);
    weeklyData[weekNum].clicks += parseInt(d.clicks || 0);
    weeklyData[weekNum].spend += parseFloat(d.spend || 0);
    weeklyData[weekNum].conversions += parseInt(d.conversions || 0);
  });

  Object.keys(weeklyData).forEach((week) => {
    const w = weeklyData[week];
    const ctr = w.impressions > 0 ? (w.clicks / w.impressions) * 100 : 0;
    const cpc = w.clicks > 0 ? w.spend / w.clicks : 0;

    sections.push(`第${parseInt(week) + 1}週,${w.impressions.toLocaleString()},${w.clicks.toLocaleString()},¥${w.spend.toLocaleString()},${w.conversions},${ctr.toFixed(2)}%,¥${cpc.toFixed(2)}`);
  });
  sections.push("");

  // セクション5: キャンペーン別パフォーマンス（トップ5）
  sections.push("=== トップ5キャンペーン（支出順） ===");
  sections.push("キャンペーン名,インプレッション,クリック,広告費,コンバージョン,CTR,CPC,ROAS");

  campaigns
    .sort((a: any, b: any) => parseFloat(b.spend || 0) - parseFloat(a.spend || 0))
    .slice(0, 5)
    .forEach((c: any) => {
      const cRoas = parseFloat(c.purchase_roas?.[0]?.value || 0);
      sections.push(
        `"${c.campaign_name}",${c.impressions || 0},${c.clicks || 0},¥${parseFloat(c.spend || 0).toFixed(2)},${c.conversions || 0},${parseFloat(c.ctr || 0).toFixed(2)}%,¥${parseFloat(c.cpc || 0).toFixed(2)},${cRoas.toFixed(2)}`
      );
    });
  sections.push("");

  // セクション6: 懸念事項
  sections.push("=== 懸念事項 ===");
  if (analysis.concerns.length === 0) {
    sections.push("懸念事項,なし - パフォーマンスは良好です");
  } else {
    sections.push("No.,懸念内容");
    analysis.concerns.forEach((concern: string, idx: number) => {
      sections.push(`${idx + 1},"${concern}"`);
    });
  }
  sections.push("");

  // セクション7: 推奨アクション
  sections.push("=== 推奨アクション ===");
  sections.push("優先度,アクション内容");
  analysis.recommendations.forEach((rec: string, idx: number) => {
    const priority = idx === 0 ? "高" : idx === 1 ? "中" : "低";
    sections.push(`${priority},"${rec}"`);
  });
  sections.push("");

  // セクション8: 次のステップ
  sections.push("=== ネクストステップ ===");
  sections.push("ステップ,実施内容");
  sections.push("1,上記の懸念事項への対応策を検討");
  sections.push("2,推奨アクションの優先順位付けと実行計画策定");
  sections.push("3,2週間後のパフォーマンス再評価");
  sections.push("");

  return sections.join("\n");
}

// デバッグ用：Meta APIの生レスポンスを確認
async function handleDebugMetaApiResponse(args: any) {
  const accessToken = getMetaAccessToken();

  const { account_id, date_preset = "last_30d" } = args;

  try {
    // アカウントレベルのデータ取得
    const response = await axios.get(
      `https://graph.facebook.com/v21.0/${account_id}/insights`,
      {
        params: {
          access_token: accessToken,
          level: "account",
          date_preset: date_preset,
          fields: "account_id,account_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,conversions,actions,action_values,purchase_roas,date_start,date_stop",
        },
      }
    );

    // 生データをそのまま返す
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Meta APIの生レスポンス（デバッグ用）",
            account_id,
            date_preset,
            api_url: `https://graph.facebook.com/v21.0/${account_id}/insights`,
            raw_response: response.data,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Meta APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

/**
 * Google Ads APIのアクセストークンをリフレッシュトークンから取得
 */
async function getGoogleAdsAccessToken(credentials: {
  refresh_token: string;
  client_id: string;
  client_secret: string;
}): Promise<string> {
  const response = await axios.post("https://oauth2.googleapis.com/token", {
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: credentials.refresh_token,
    grant_type: "refresh_token",
  });
  return response.data.access_token;
}

/**
 * Google Ads APIにGAQLクエリを実行（単一認証情報）
 */
async function executeGoogleAdsQueryWithCredentials(
  customerId: string,
  query: string,
  credentials: { refresh_token: string; client_id: string; client_secret: string; developer_token?: string }
): Promise<any[]> {
  const accessToken = await getGoogleAdsAccessToken(credentials);
  const cleanCustomerId = customerId.replace(/-/g, "");
  const developerToken = (credentials.developer_token && credentials.developer_token !== 'dummy_token')
    ? credentials.developer_token
    : (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "");

  const response = await axios.post(
    `https://googleads.googleapis.com/v20/customers/${cleanCustomerId}/googleAds:searchStream`,
    { query },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  );

  const results: any[] = [];
  if (Array.isArray(response.data)) {
    for (const batch of response.data) {
      if (batch.results) {
        results.push(...batch.results);
      }
    }
  }
  return results;
}

/**
 * Google Ads APIにGAQLクエリを実行（複数アカウント対応）
 * 全てのトークンを試して、アクセスできるものを使用
 */
async function executeGoogleAdsQuery(
  customerId: string,
  query: string,
  credentials?: ReturnType<typeof getGoogleAdsCredentials>
): Promise<any[]> {
  // 指定されたクレデンシャルがあればそれを使用
  if (credentials) {
    return executeGoogleAdsQueryWithCredentials(customerId, query, credentials);
  }

  // 複数アカウントから試行
  const accounts = tokenManager.getAllGoogleAdsAccounts();
  if (accounts.length === 0) {
    // フォールバック: 環境変数から
    const envCredentials = getGoogleAdsCredentials();
    return executeGoogleAdsQueryWithCredentials(customerId, query, envCredentials);
  }

  let lastError: any = null;
  for (const account of accounts) {
    try {
      return await executeGoogleAdsQueryWithCredentials(customerId, query, {
        refresh_token: account.refresh_token,
        client_id: account.client_id,
        client_secret: account.client_secret,
        developer_token: account.developer_token,
      });
    } catch (err: any) {
      lastError = err;
      // PERMISSION_DENIED等の場合は次のアカウントを試す
      continue;
    }
  }

  throw lastError || new Error("アクセス可能なGoogle Adsアカウントが見つかりませんでした");
}

// Google広告アカウント一覧取得（複数アカウント対応）
async function handleListGoogleAdAccounts() {
  const allGoogleAccounts = tokenManager.getAllGoogleAdsAccounts();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "";

  // トークンがない場合は環境変数にフォールバック
  if (allGoogleAccounts.length === 0) {
    const credentials = getGoogleAdsCredentials();
    allGoogleAccounts.push({
      email: "env",
      refresh_token: credentials.refresh_token,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      developer_token: credentials.developer_token,
      timestamp: Date.now(),
    });
  }

  const accounts: any[] = [];
  const seenCustomerIds = new Set<string>();

  for (const googleAccount of allGoogleAccounts) {
    try {
      const accessToken = await getGoogleAdsAccessToken(googleAccount);

      const listResponse = await axios.get(
        "https://googleads.googleapis.com/v20/customers:listAccessibleCustomers",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": googleAccount.developer_token || developerToken,
          },
        }
      );

      const resourceNames: string[] = listResponse.data.resourceNames || [];

      for (const resourceName of resourceNames) {
        const customerId = resourceName.replace("customers/", "");

        // 重複をスキップ
        if (seenCustomerIds.has(customerId)) continue;
        seenCustomerIds.add(customerId);

        try {
          const results = await executeGoogleAdsQueryWithCredentials(
            customerId,
            `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1`,
            {
              refresh_token: googleAccount.refresh_token,
              client_id: googleAccount.client_id,
              client_secret: googleAccount.client_secret,
              developer_token: googleAccount.developer_token,
            }
          );

          if (results.length > 0) {
            const customer = results[0].customer;
            accounts.push({
              id: customer.id,
              name: customer.descriptiveName || "(名前なし)",
              currency: customer.currencyCode,
              timezone: customer.timeZone,
              is_manager: customer.manager || false,
              linked_email: googleAccount.email,
            });
          }
        } catch (err: any) {
          accounts.push({
            id: customerId,
            name: "(アクセス不可)",
            linked_email: googleAccount.email,
            error: err.response?.data?.error?.message || err.message,
          });
        }
      }
    } catch (error: any) {
      // このアカウントのトークンが無効な場合はスキップ
      console.error(`Google Ads APIエラー (${googleAccount.email}):`, error.message);
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          count: accounts.length,
          accounts,
        }, null, 2),
      },
    ],
  };
}

// Googleキャンペーンパフォーマンス取得
async function handleGetGoogleCampaignPerformance(args: any) {
  const credentials = getGoogleAdsCredentials();

  const { customer_id, start_date, end_date } = args;

  // デフォルト期間: 過去30日
  const today = new Date();
  const defaultEnd = today.toISOString().split("T")[0];
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const dateFrom = start_date || defaultStart;
  const dateTo = end_date || defaultEnd;

  try {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm
      FROM campaign
      WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    const results = await executeGoogleAdsQuery(customer_id, query, credentials);

    const campaigns = results.map((r: any) => {
      const c = r.campaign;
      const m = r.metrics;
      const costYen = (parseInt(m.costMicros || "0") / 1_000_000);

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        channel_type: c.advertisingChannelType,
        impressions: parseInt(m.impressions || "0"),
        clicks: parseInt(m.clicks || "0"),
        cost: costYen.toFixed(2),
        conversions: parseFloat(m.conversions || "0").toFixed(2),
        conversions_value: parseFloat(m.conversionsValue || "0").toFixed(2),
        ctr: (parseFloat(m.ctr || "0") * 100).toFixed(2) + "%",
        avg_cpc: (parseInt(m.averageCpc || "0") / 1_000_000).toFixed(2),
        avg_cpm: (parseInt(m.averageCpm || "0") / 1_000_000).toFixed(2),
        roas: costYen > 0
          ? (parseFloat(m.conversionsValue || "0") / costYen).toFixed(2)
          : "0",
      };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            customer_id,
            period: `${dateFrom} ~ ${dateTo}`,
            count: campaigns.length,
            campaigns,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Google Ads APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// Google広告クリエイティブ取得
async function handleGetGoogleAdCreatives(args: any) {
  const credentials = getGoogleAdsCredentials();

  const { customer_id, campaign_id, ad_status } = args;

  try {
    let whereClause = "ad_group_ad.status != 'REMOVED'";
    if (ad_status) {
      whereClause = `ad_group_ad.status = '${ad_status}'`;
    }
    if (campaign_id) {
      whereClause += ` AND campaign.id = ${campaign_id}`;
    }

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.type,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.responsive_display_ad.headlines,
        ad_group_ad.ad.responsive_display_ad.long_headline,
        ad_group_ad.ad.responsive_display_ad.descriptions,
        ad_group_ad.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions
      FROM ad_group_ad
      WHERE ${whereClause}
      ORDER BY metrics.impressions DESC
      LIMIT 100
    `;

    const results = await executeGoogleAdsQuery(customer_id, query, credentials);

    const ads = results.map((r: any) => {
      const campaign = r.campaign;
      const adGroup = r.adGroup;
      const adGroupAd = r.adGroupAd;
      const ad = adGroupAd?.ad || {};
      const metrics = r.metrics;

      // 見出しと説明文を抽出
      let headlines: string[] = [];
      let descriptions: string[] = [];
      let longHeadline = "";

      // レスポンシブ検索広告
      if (ad.responsiveSearchAd) {
        headlines = (ad.responsiveSearchAd.headlines || []).map(
          (h: any) => h.text
        );
        descriptions = (ad.responsiveSearchAd.descriptions || []).map(
          (d: any) => d.text
        );
      }

      // レスポンシブディスプレイ広告
      if (ad.responsiveDisplayAd) {
        headlines = (ad.responsiveDisplayAd.headlines || []).map(
          (h: any) => h.text
        );
        descriptions = (ad.responsiveDisplayAd.descriptions || []).map(
          (d: any) => d.text
        );
        longHeadline = ad.responsiveDisplayAd.longHeadline?.text || "";
      }

      const costYen = parseInt(metrics?.costMicros || "0") / 1_000_000;

      return {
        campaign_id: campaign?.id,
        campaign_name: campaign?.name,
        ad_group_id: adGroup?.id,
        ad_group_name: adGroup?.name,
        ad_id: ad.id,
        ad_name: ad.name || "",
        ad_type: ad.type,
        status: adGroupAd?.status,
        final_urls: ad.finalUrls || [],
        headlines,
        descriptions,
        long_headline: longHeadline || undefined,
        metrics: {
          impressions: parseInt(metrics?.impressions || "0"),
          clicks: parseInt(metrics?.clicks || "0"),
          cost: costYen.toFixed(2),
          ctr: (parseFloat(metrics?.ctr || "0") * 100).toFixed(2) + "%",
          conversions: parseFloat(metrics?.conversions || "0").toFixed(2),
        },
      };
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            customer_id,
            count: ads.length,
            ads,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `Google Ads APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// ========== GA4 Analytics ハンドラー ==========

/**
 * GA4用のアクセストークンを取得
 * Google Adsと同じOAuth認証情報を使用
 */
async function getGa4AccessToken(): Promise<string> {
  const accounts = tokenManager.getAllGoogleAdsAccounts();

  if (accounts.length > 0) {
    return await getGoogleAdsAccessToken(accounts[0]);
  }

  // フォールバック: 環境変数
  const credentials = getGoogleAdsCredentials();
  return await getGoogleAdsAccessToken(credentials);
}

// GA4プロパティ一覧取得
async function handleListGa4Properties() {
  try {
    const accessToken = await getGa4AccessToken();

    const response = await axios.get(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { pageSize: 200 },
      }
    );

    const accountSummaries = response.data.accountSummaries || [];

    const properties: any[] = [];
    for (const account of accountSummaries) {
      for (const prop of account.propertySummaries || []) {
        properties.push({
          account_name: account.displayName,
          account_id: account.account?.replace("accounts/", ""),
          property_name: prop.displayName,
          property_id: prop.property?.replace("properties/", ""),
          property_resource: prop.property,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            count: properties.length,
            properties,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4カスタムレポート取得
async function handleGetGa4Report(args: any) {
  const {
    property_id,
    dimensions,
    metrics,
    start_date = "30daysAgo",
    end_date = "yesterday",
    limit = 100,
    dimension_filter,
    order_by,
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const requestBody: any = {
      dateRanges: [{ startDate: start_date, endDate: end_date }],
      metrics: metrics.split(",").map((m: string) => ({ name: m.trim() })),
      limit,
    };

    if (dimensions) {
      requestBody.dimensions = dimensions
        .split(",")
        .map((d: string) => ({ name: d.trim() }));
    }

    if (dimension_filter) {
      try {
        const filter = JSON.parse(dimension_filter);
        requestBody.dimensionFilter = { filter };
      } catch {
        // フィルタが無効な場合はスキップ
      }
    }

    if (order_by) {
      requestBody.orderBys = [
        { metric: { metricName: order_by }, desc: true },
      ];
    }

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        result[metricHeaders[i]] = val.value;
      });
      return result;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            period: `${start_date} ~ ${end_date}`,
            row_count: rows.length,
            total_rows: data.rowCount || rows.length,
            dimensions: dimHeaders,
            metrics: metricHeaders,
            rows,
            totals: data.totals?.[0]
              ? Object.fromEntries(
                  metricHeaders.map((name: string, i: number) => [
                    name,
                    data.totals[0].metricValues[i]?.value,
                  ])
                )
              : undefined,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4リアルタイムデータ取得
async function handleGetGa4Realtime(args: any) {
  const {
    property_id,
    dimensions,
    metrics = "activeUsers",
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const requestBody: any = {
      metrics: metrics.split(",").map((m: string) => ({ name: m.trim() })),
    };

    if (dimensions) {
      requestBody.dimensions = dimensions
        .split(",")
        .map((d: string) => ({ name: d.trim() }));
    }

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runRealtimeReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        result[metricHeaders[i]] = val.value;
      });
      return result;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            realtime: true,
            row_count: rows.length,
            dimensions: dimHeaders,
            metrics: metricHeaders,
            rows,
            totals: data.totals?.[0]
              ? Object.fromEntries(
                  metricHeaders.map((name: string, i: number) => [
                    name,
                    data.totals[0].metricValues[i]?.value,
                  ])
                )
              : undefined,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4流入元分析
async function handleGetGa4TrafficSources(args: any) {
  const {
    property_id,
    start_date = "30daysAgo",
    end_date = "yesterday",
    breakdown = "source_medium",
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const dimensionMap: Record<string, string[]> = {
      channel: ["sessionDefaultChannelGroup"],
      source_medium: ["sessionSource", "sessionMedium"],
      campaign: ["sessionCampaignName", "sessionSource", "sessionMedium"],
    };

    const dims = dimensionMap[breakdown] || dimensionMap.source_medium;

    const requestBody = {
      dateRanges: [{ startDate: start_date, endDate: end_date }],
      dimensions: dims.map((d) => ({ name: d })),
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViewsPerSession" },
        { name: "conversions" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 50,
    };

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        const name = metricHeaders[i];
        const v = val.value;
        if (name === "bounceRate") {
          result[name] = (parseFloat(v) * 100).toFixed(2) + "%";
        } else if (name === "averageSessionDuration") {
          result[name] = parseFloat(v).toFixed(1) + "s";
        } else if (name === "screenPageViewsPerSession") {
          result[name] = parseFloat(v).toFixed(2);
        } else {
          result[name] = v;
        }
      });
      return result;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            period: `${start_date} ~ ${end_date}`,
            breakdown,
            row_count: rows.length,
            rows,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4ページパフォーマンス
async function handleGetGa4PagePerformance(args: any) {
  const {
    property_id,
    start_date = "30daysAgo",
    end_date = "yesterday",
    page_path_filter,
    limit = 50,
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const requestBody: any = {
      dateRanges: [{ startDate: start_date, endDate: end_date }],
      dimensions: [
        { name: "pagePath" },
        { name: "pageTitle" },
      ],
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "engagementRate" },
        { name: "conversions" },
      ],
      orderBys: [
        { metric: { metricName: "screenPageViews" }, desc: true },
      ],
      limit,
    };

    if (page_path_filter) {
      requestBody.dimensionFilter = {
        filter: {
          fieldName: "pagePath",
          stringFilter: {
            matchType: "CONTAINS",
            value: page_path_filter,
          },
        },
      };
    }

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        const name = metricHeaders[i];
        const v = val.value;
        if (name === "bounceRate" || name === "engagementRate") {
          result[name] = (parseFloat(v) * 100).toFixed(2) + "%";
        } else if (name === "averageSessionDuration") {
          result[name] = parseFloat(v).toFixed(1) + "s";
        } else {
          result[name] = v;
        }
      });
      return result;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            period: `${start_date} ~ ${end_date}`,
            page_filter: page_path_filter || "なし",
            row_count: rows.length,
            rows,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4コンバージョン分析
async function handleGetGa4Conversions(args: any) {
  const {
    property_id,
    start_date = "30daysAgo",
    end_date = "yesterday",
    event_name,
    breakdown = "event",
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const breakdownDims: Record<string, string[]> = {
      event: ["eventName"],
      source_medium: ["eventName", "sessionSource", "sessionMedium"],
      page: ["eventName", "pagePath"],
    };

    const dims = breakdownDims[breakdown] || breakdownDims.event;

    const requestBody: any = {
      dateRanges: [{ startDate: start_date, endDate: end_date }],
      dimensions: dims.map((d) => ({ name: d })),
      metrics: [
        { name: "conversions" },
        { name: "totalRevenue" },
        { name: "totalUsers" },
      ],
      orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
      limit: 50,
    };

    // isConversionEvent でフィルタ（コンバージョンイベントのみ取得）
    const filters: any[] = [];

    if (event_name) {
      filters.push({
        filter: {
          fieldName: "eventName",
          stringFilter: {
            matchType: "EXACT",
            value: event_name,
          },
        },
      });
    }

    if (filters.length === 1) {
      requestBody.dimensionFilter = filters[0];
    } else if (filters.length > 1) {
      requestBody.dimensionFilter = {
        andGroup: { expressions: filters },
      };
    }

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        result[metricHeaders[i]] = val.value;
      });
      return result;
    });

    // conversions > 0 のみフィルタ
    const filteredRows = rows.filter(
      (r: any) => parseInt(r.conversions || "0") > 0
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            period: `${start_date} ~ ${end_date}`,
            breakdown,
            event_filter: event_name || "全コンバージョンイベント",
            row_count: filteredRows.length,
            rows: filteredRows,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// GA4ユーザー属性分析
async function handleGetGa4UserDemographics(args: any) {
  const {
    property_id,
    start_date = "30daysAgo",
    end_date = "yesterday",
    dimension_type = "device",
  } = args;

  try {
    const accessToken = await getGa4AccessToken();

    const dimensionMap: Record<string, string> = {
      country: "country",
      city: "city",
      device: "deviceCategory",
      browser: "browser",
      os: "operatingSystem",
      language: "language",
    };

    const dimensionName = dimensionMap[dimension_type] || dimensionMap.device;

    const requestBody = {
      dateRanges: [{ startDate: start_date, endDate: end_date }],
      dimensions: [{ name: dimensionName }],
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViewsPerSession" },
        { name: "conversions" },
      ],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: 50,
    };

    const response = await axios.post(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property_id}:runReport`,
      requestBody,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = response.data;
    const dimHeaders = (data.dimensionHeaders || []).map((h: any) => h.name);
    const metricHeaders = (data.metricHeaders || []).map((h: any) => h.name);

    const rows = (data.rows || []).map((row: any) => {
      const result: any = {};
      (row.dimensionValues || []).forEach((val: any, i: number) => {
        result[dimHeaders[i]] = val.value;
      });
      (row.metricValues || []).forEach((val: any, i: number) => {
        const name = metricHeaders[i];
        const v = val.value;
        if (name === "bounceRate") {
          result[name] = (parseFloat(v) * 100).toFixed(2) + "%";
        } else if (name === "averageSessionDuration") {
          result[name] = parseFloat(v).toFixed(1) + "s";
        } else if (name === "screenPageViewsPerSession") {
          result[name] = parseFloat(v).toFixed(2);
        } else {
          result[name] = v;
        }
      });
      return result;
    });

    // ユーザー比率を計算
    const totalUsers = rows.reduce(
      (sum: number, r: any) => sum + parseInt(r.totalUsers || "0"),
      0
    );
    const rowsWithShare = rows.map((r: any) => ({
      ...r,
      user_share:
        totalUsers > 0
          ? ((parseInt(r.totalUsers || "0") / totalUsers) * 100).toFixed(1) + "%"
          : "0%",
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            property_id,
            period: `${start_date} ~ ${end_date}`,
            dimension_type,
            total_users: totalUsers,
            row_count: rowsWithShare.length,
            rows: rowsWithShare,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    throw new Error(
      `GA4 APIエラー: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

// サーバーを起動
async function main() {
  // コマンドライン引数をチェック
  const args = process.argv.slice(2);
  const withOAuth = args.includes('--with-oauth') || args.includes('--oauth');

  if (withOAuth) {
    // OAuthサーバーを起動
    const { startOAuthServer } = await import('./oauth-server.js');
    startOAuthServer();
    console.log('\n💡 OAuthサーバーと同時にMCPサーバーも起動しています...\n');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
