import { Router, type IRouter } from "express";
import {
  GetBotStatusResponse,
  GetDashboardResponse,
  ListCollectiblesResponse,
  ListPurchasesResponse,
  ListOwnedCollectiblesResponse,
  ListPrepaidUpgradeGiftsResponse,
} from "@workspace/api-zod";

type Purchase = {
  id: string;
  collectibleId: string;
  collectibleName: string;
  priceStars: number;
  transferFeeStars: number;
  totalCostStars: number;
  recipientChatId: string;
  status: "queued" | "sent" | "failed" | "manual_review";
  createdAt: string | Date;
  message: string;
};

const collectibles = [
  {
    id: "aurora-vault",
    name: "Aurora Vault",
    collection: "Skyline Relics",
    priceStars: 1200,
    rarity: "legendary" as const,
    accent: "#d9b7ff",
    description: "A limited collectible gift selected for long-term ownership.",
    available: true,
    collectible: true,
    resellable: true,
    transferFeeStars: 80,
  },
  {
    id: "velvet-comet",
    name: "Velvet Comet",
    collection: "Night Market",
    priceStars: 840,
    rarity: "rare" as const,
    accent: "#ffb5d7",
    description: "A resellable collectible with a low transfer overhead.",
    available: true,
    collectible: true,
    resellable: true,
    transferFeeStars: 60,
  },
  {
    id: "cobalt-crest",
    name: "Cobalt Crest",
    collection: "Signal Foundry",
    priceStars: 560,
    rarity: "rare" as const,
    accent: "#87c8ff",
    description: "A verified collectible option for a smaller Star allocation.",
    available: true,
    collectible: true,
    resellable: true,
    transferFeeStars: 40,
  },
  {
    id: "ember-seal",
    name: "Ember Seal",
    collection: "Archive Series",
    priceStars: 320,
    rarity: "common" as const,
    accent: "#ffbd83",
    description: "A resellable entry collectible with a predictable transfer fee.",
    available: true,
    collectible: true,
    resellable: true,
    transferFeeStars: 25,
  },
];

const purchases: Purchase[] = [];

async function telegramRequest<T>(
  method: string,
  body?: Record<string, string | number>,
): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };

  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new Error(payload.description ?? `Telegram request failed (${response.status})`);
  }

  return payload.result;
}

async function getBotStatus() {
  try {
    const bot = await telegramRequest<{ first_name: string; username?: string }>("getMe");
    const balance = await telegramRequest<{ amount: number }>("getMyStarBalance");
    return GetBotStatusResponse.parse({
      connected: true,
      botName: bot.first_name,
      username: bot.username ?? "Telegram bot",
      starBalance: balance.amount,
      balanceVerified: true,
      recipientConfigured: false,
      collectibleGiftsOnly: true,
      transactionExecutable: false,
      executionBlockReason:
        "Blocked by Telegram's Bot API: collectible purchase and ownership transfer are not executable in read-only mode.",
      message: "Live Telegram balance verified. Only collectible, resellable gifts are allowed.",
    });
  } catch (error) {
    return GetBotStatusResponse.parse({
      connected: false,
      botName: "Telegram bot",
      username: "Not connected",
      starBalance: 0,
      balanceVerified: false,
      recipientConfigured: false,
      collectibleGiftsOnly: true,
      transactionExecutable: false,
      executionBlockReason: "Blocked because the Telegram bot connection could not be verified.",
      message:
        error instanceof Error
          ? error.message
          : "Telegram connection could not be verified.",
    });
  }
}

const router: IRouter = Router();

router.get("/collectibles", (_req, res) => {
  res.json(ListCollectiblesResponse.parse(collectibles));
});

router.get("/bot/status", async (_req, res) => {
  res.json(await getBotStatus());
});

router.get("/owned-collectibles", (_req, res) => {
  res.json(
    ListOwnedCollectiblesResponse.parse({
      items: [],
      supported: false,
      message: "Not supported by current Bot API. Owned collectible inventory and transfers are unavailable in read-only mode.",
    }),
  );
});

router.get("/bot/prepaid-upgrade-gifts", async (_req, res) => {
  try {
    const available = await telegramRequest<{
      gifts: Array<{
        id: string;
        star_count: number;
        upgrade_star_count?: number;
      }>;
    }>("getAvailableGifts");
    const balance = await telegramRequest<{ amount: number }>("getMyStarBalance");
    const gifts = available.gifts
      .filter((gift) => typeof gift.upgrade_star_count === "number" && gift.upgrade_star_count > 0)
      .map((gift) => {
        const upgradeFeeStars = gift.upgrade_star_count ?? 0;
        const totalStars = gift.star_count + upgradeFeeStars;
        return {
          id: gift.id,
          giftPriceStars: gift.star_count,
          upgradeFeeStars,
          totalStars,
          affordable: totalStars <= balance.amount,
          payForUpgrade: true,
        };
      })
      .filter((gift) => gift.affordable);

    res.json(
      ListPrepaidUpgradeGiftsResponse.parse({
        supported: true,
        recipientUserId: "8598790977",
        botBalanceStars: balance.amount,
        gifts,
        message: gifts.length
          ? "Eligible gifts found. No Stars were spent; approval is still required."
          : "No currently available affordable gift supports a prepaid collectible upgrade.",
      }),
    );
  } catch (error) {
    res.json(
      ListPrepaidUpgradeGiftsResponse.parse({
        supported: false,
        recipientUserId: "8598790977",
        botBalanceStars: 0,
        gifts: [],
        message:
          error instanceof Error
            ? `Not supported by current Bot API: ${error.message}`
            : "Not supported by current Bot API.",
      }),
    );
  }
});

router.get("/purchases", (_req, res) => {
  res.json(ListPurchasesResponse.parse(purchases.slice(0, 12)));
});

router.get("/dashboard", async (_req, res) => {
  const bot = await getBotStatus();
  const totalSpent = purchases.reduce((sum, purchase) => sum + purchase.totalCostStars, 0);
  const deliveredCount = purchases.filter((purchase) => purchase.status === "sent").length;
  const queuedCount = purchases.filter(
    (purchase) => purchase.status === "queued" || purchase.status === "manual_review",
  ).length;

  res.json(
    GetDashboardResponse.parse({
      starBalance: bot.starBalance,
      totalSpent,
      deliveredCount,
      queuedCount,
      bot,
      recentPurchases: purchases.slice(0, 5),
    }),
  );
});

export default router;