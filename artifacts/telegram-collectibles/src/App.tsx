import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  Clock3,
  Coins,
  Gem,
  History,
  Inbox,
  LayoutGrid,
  LockKeyhole,
  MessageCircle,
  Search,
  RefreshCw,
  ShieldAlert,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import {
  getListCollectiblesQueryKey,
  getListResaleCollectiblesQueryKey,
  getListResaleTransactionsQueryKey,
  useConfirmResalePurchase,
  useGetBotStatus,
  useGetDashboard,
  useListOwnedCollectibles,
  useListCollectibles,
  useListPurchases,
  useListResaleCollectibles,
  useListResaleGiftTypes,
  useListResaleTransactions,
  usePreviewResalePaymentForm,
} from '@workspace/api-client-react';
import type { BotStatus, Collectible, Purchase } from '@workspace/api-client-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function formatStars(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

const AUTHORIZED_RECIPIENT_USERNAME = '@arshxy';
const AUTHORIZED_RECIPIENT_ID = '8598790977';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: Purchase['status']) {
  return status === 'manual_review'
    ? 'Manual review'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function AppShell({
  children,
  bot,
}: {
  children: ReactNode;
  bot?: BotStatus;
}) {
  const [location] = useLocation();
  const connected = bot?.connected ?? false;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" data-testid="link-brand">
          <span className="brand-mark">TG</span>
          <span>
            <span className="brand-name">vault / gift</span>
          <span className="brand-sub">collectibles desk</span>
          </span>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-browse">
            <LayoutGrid size={16} strokeWidth={1.8} /> Browse gifts
          </Link>
          <Link href="/resale" className={`nav-link ${location === '/resale' ? 'active' : ''}`} data-testid="link-resale">
            <Tag size={16} strokeWidth={1.8} /> Resale inspector
          </Link>
          <Link href="/history" className={`nav-link ${location === '/history' ? 'active' : ''}`} data-testid="link-history">
            <History size={16} strokeWidth={1.8} /> Request history
          </Link>
          <Link href="/settings" className={`nav-link ${location === '/settings' ? 'active' : ''}`} data-testid="link-settings">
            <Settings2 size={16} strokeWidth={1.8} /> Settings
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="status-mini">
            <span className="status-dot" style={{ background: connected ? '#e4b13a' : '#d78371' }} />
            {connected ? 'Bot connection live' : 'Bot connection needs attention'}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <span>vault / gift</span>
            <ArrowRight size={13} />
            <strong>{location === '/' ? 'Browse' : location === '/history' ? 'History' : location === '/settings' ? 'Settings' : 'Resale inspector'}</strong>
          </div>
          <div className="topbar-actions">
            <div className="balance-pill" data-testid="text-topbar-balance">
              <span className="star-token"><Coins size={10} strokeWidth={2.4} /></span>
              {location === '/resale'
                ? bot?.balanceVerified ? `${formatStars(bot.starBalance)} Stars` : 'Unavailable'
                : bot ? `${formatStars(bot.starBalance)} Stars` : '— Stars'}
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="collectible-grid" aria-label="Loading gifts">
      {[1, 2, 3, 4].map((item) => (
        <div className="gift-card" key={item}>
          <div className="skeleton" style={{ width: 43, height: 43 }} />
          <div className="skeleton" style={{ width: '55%', height: 17, marginTop: 21 }} />
          <div className="skeleton" style={{ width: '35%', height: 11, marginTop: 7 }} />
          <div className="skeleton" style={{ width: '85%', height: 25, marginTop: 13 }} />
        </div>
      ))}
    </div>
  );
}

function QueryError({ onRetry, message = 'We could not reach the vault service.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="error-card" role="alert">
      <CircleAlert size={23} style={{ margin: '0 auto 9px' }} />
      <h3>Connection interrupted</h3>
      <p>{message}</p>
      <button type="button" className="retry-button" onClick={onRetry} data-testid="button-retry">
        <RefreshCw size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Try again
      </button>
    </div>
  );
}

function GiftCard({ gift, selected, onSelect }: { gift: Collectible; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`gift-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{ textAlign: 'left', width: '100%', '--gift-accent': gift.accent } as CSSProperties}
      data-testid={`card-collectible-${gift.id}`}
      aria-pressed={selected}
    >
      <div className="gift-top">
        <span className="gift-orb">{gift.name.slice(0, 1).toUpperCase()}</span>
        <span className={`rarity ${gift.rarity}`}>{gift.rarity}</span>
      </div>
      <div className="gift-name" data-testid={`text-collectible-name-${gift.id}`}>{gift.name}</div>
      <div className="gift-collection">{gift.collection}</div>
      <div className="gift-desc">{gift.description}</div>
      <div className="gift-footer">
        <div>
          <div className="price">{formatStars(gift.priceStars)} Stars</div>
          <div className="fee">+ {formatStars(gift.transferFeeStars)} transfer fee</div>
        </div>
        <span className="select-indicator">{selected ? <Check size={13} strokeWidth={3} /> : null}</span>
      </div>
    </button>
  );
}

function PurchasePanel({ gift, bot }: {
  gift?: Collectible;
  bot?: BotStatus;
}) {
  const total = gift ? gift.priceStars + gift.transferFeeStars : 0;

  return (
    <section className="surface purchase-panel" data-testid="panel-preview">
      <div className="surface-head">
        <div>
          <div className="surface-title">Transaction preview</div>
          <div className="surface-subtitle">Read-only planning. No Stars are spent.</div>
        </div>
        <LockKeyhole size={17} color="#6c8c78" />
      </div>
      <div className="purchase-body">
        {gift ? (
          <>
            <div className="selected-preview">
              <span className="gift-orb" style={{ '--gift-accent': gift.accent } as CSSProperties}>{gift.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <div className="preview-title">{gift.name}</div>
                <div className="preview-caption">{gift.collection} · verified collectible</div>
              </div>
            </div>
            <div className="cost-breakdown" data-testid="text-cost-breakdown">
              <div className="cost-line"><span>Gift price</span><strong>{formatStars(gift.priceStars)} Stars</strong></div>
              <div className="cost-line"><span>Transfer fee</span><strong>{formatStars(gift.transferFeeStars)} Stars</strong></div>
              <div className="cost-line cost-total"><span>Total from Star balance</span><strong>{formatStars(total)} Stars</strong></div>
            </div>
            <div className="message-box" style={{ marginTop: 16 }}>
              <strong>{bot?.transactionExecutable ? 'Executable' : 'Blocked by Telegram API'}</strong>
              <div style={{ marginTop: 5 }}>{bot?.executionBlockReason ?? 'Waiting for a verified bot capability response.'}</div>
            </div>
          </>
        ) : (
          <div className="empty-select">
            <Gem size={24} />
            Select a gift to see its verified price, transfer fee, and delivery details.
          </div>
        )}
      </div>
    </section>
  );
}

function TransferPanel() {
  const ownedQuery = useListOwnedCollectibles();
  const [recipientId, setRecipientId] = useState('8598790977');
  const [selectedId, setSelectedId] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const items = ownedQuery.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId);

  return (
    <section className="surface transfer-panel" data-testid="section-transfer-preview">
      <div className="surface-head">
        <div>
          <div className="eyebrow">Ownership / transfer</div>
          <div className="surface-title">NFT / Collectible Transfer</div>
          <div className="surface-subtitle">Preview an already-owned collectible transfer. Nothing is sent from this screen.</div>
        </div>
        <LockKeyhole size={17} color="#6c8c78" />
      </div>
      <div className="purchase-body">
        {reviewing && selected ? (
          <div data-testid="transfer-confirmation">
            <div className="eyebrow">Confirmation required</div>
            <h2 style={{ marginTop: 8 }}>Review transfer details</h2>
            <p className="surface-subtitle" style={{ marginTop: 7 }}>
              Confirm the collectible, recipient, and fee before any transfer could be attempted.
            </p>
            <div className="cost-breakdown" style={{ marginTop: 18 }}>
              <div className="cost-line"><span>Collectible</span><strong>{selected.name}</strong></div>
              <div className="cost-line"><span>Recipient</span><strong className="mono">{recipientId}</strong></div>
              <div className="cost-line cost-total"><span>Required transfer fee</span><strong>{formatStars(selected.transferFeeStars)} Stars</strong></div>
            </div>
            <div className="message-box" style={{ marginTop: 16 }}>
              <strong>Not supported by current Bot API</strong>
              <div style={{ marginTop: 5 }}>The transfer is not executable. No Stars will be spent and no ownership state will change.</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="retry-button" onClick={() => setReviewing(false)} data-testid="button-edit-transfer">Back to edit</button>
              <button type="button" className="button-primary" disabled data-testid="button-confirm-transfer">Transfer unavailable</button>
            </div>
          </div>
        ) : (
          <>
            <label className="field-label" htmlFor="owned-collectible">Already-owned collectible</label>
            <select
              id="owned-collectible"
              className="text-input"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={!items.length || !ownedQuery.data?.supported}
              data-testid="select-owned-collectible"
            >
              <option value="">{items.length ? 'Select a collectible' : 'No owned collectibles available'}</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatStars(item.transferFeeStars)} Stars fee</option>)}
            </select>
            <label className="field-label" htmlFor="transfer-recipient-id" style={{ marginTop: 14 }}>Recipient Telegram user ID</label>
            <input
              id="transfer-recipient-id"
              className="text-input"
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              data-testid="input-transfer-recipient-id"
            />
            <div className="input-help">@arshxy · 8598790977</div>
            {selected ? (
              <div className="cost-breakdown" style={{ marginTop: 16 }}>
                <div className="cost-line"><span>Collectible</span><strong>{selected.name}</strong></div>
                <div className="cost-line cost-total"><span>Required transfer fee</span><strong>{formatStars(selected.transferFeeStars)} Stars</strong></div>
              </div>
            ) : null}
            <div className="message-box" style={{ marginTop: 16 }}>
              <strong>Not supported by current Bot API</strong>
              <div style={{ marginTop: 5 }}>{ownedQuery.data?.message ?? 'Checking transfer capability…'}</div>
            </div>
            <button
              type="button"
              className="button-primary"
              onClick={() => setReviewing(true)}
              disabled={!selected || !recipientId.trim() || !ownedQuery.data?.supported}
              style={{ marginTop: 16 }}
              data-testid="button-review-transfer"
            >
              Review transfer <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function BrowsePage() {
  const collectiblesQuery = useListCollectibles();
  const dashboardQuery = useGetDashboard();
  const botQuery = useGetBotStatus();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const gifts = useMemo(
    () => (collectiblesQuery.data ?? []).filter((gift) => gift.available && gift.collectible && gift.resellable),
    [collectiblesQuery.data],
  );
  const selectedGift = gifts.find((gift) => gift.id === selectedId);
  const bot = botQuery.data ?? dashboardQuery.data?.bot;
  const retryCatalog = () => {
    queryClient.invalidateQueries({ queryKey: getListCollectiblesQueryKey() });
  };

  if (collectiblesQuery.isLoading || dashboardQuery.isLoading || botQuery.isLoading) {
    return <div className="page"><LoadingGrid /></div>;
  }
  if (collectiblesQuery.isError) {
    return <div className="page"><QueryError onRetry={retryCatalog} /></div>;
  }

  return (
    <div className="page">
      <div className="hero-row">
        <div>
          <div className="eyebrow">Collection desk / 01</div>
          <h1 className="hero-title">Buy once.<br />Hold with intent.</h1>
          <p className="hero-copy">A clear view of Telegram gifts that are collectible, available, and eligible for resale. No ordinary gifts pass through this desk.</p>
        </div>
        <div className="trust-note"><ShieldCheck size={16} /> Only verified Star balance and resale-eligible gifts are shown.</div>
      </div>

      <div className="dashboard-grid">
        <section className="surface" data-testid="section-collectibles">
          <div className="surface-head">
            <div>
              <div className="surface-title">Eligible collectibles</div>
              <div className="surface-subtitle">{gifts.length} available in the connected bot catalog</div>
            </div>
            <div className="filter-note"><SlidersHorizontal size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} /> filtered by policy</div>
          </div>
          {gifts.length ? (
            <div className="collectible-grid">
              {gifts.map((gift) => <GiftCard key={gift.id} gift={gift} selected={gift.id === selectedId} onSelect={() => setSelectedId(gift.id)} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Inbox size={21} /></div>
              <h3>No eligible gifts right now</h3>
              <p>The catalog is connected, but no available collectible gifts currently meet the resale policy.</p>
            </div>
          )}
        </section>
        <PurchasePanel gift={selectedGift} bot={bot} />
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Verified balance</div>
          <div className="stat-value" data-testid="text-star-balance">{formatStars(bot?.starBalance ?? dashboardQuery.data?.starBalance ?? 0)} <small>Stars</small></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value" data-testid="text-delivered-count">{dashboardQuery.data?.deliveredCount ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In queue</div>
          <div className="stat-value" data-testid="text-queued-count">{dashboardQuery.data?.queuedCount ?? 0}</div>
        </div>
      </div>
      <TransferPanel />
    </div>
  );
}

function ResalePage() {
  const [giftId, setGiftId] = useState('');
  const [offset, setOffset] = useState<string | undefined>();
  const [selectedSlug, setSelectedSlug] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [confirmationAttempted, setConfirmationAttempted] = useState(false);
  const queryClient = useQueryClient();
  const giftTypesQuery = useListResaleGiftTypes();
  const params = useMemo(
    () => ({ giftId: giftId || '1', ...(offset ? { offset } : {}) }),
    [giftId, offset],
  );
  const resaleQuery = useListResaleCollectibles(params, {
    query: {
      enabled: Boolean(giftId),
      queryKey: getListResaleCollectiblesQueryKey(params),
    },
  });
  const previewMutation = usePreviewResalePaymentForm();
  const purchaseMutation = useConfirmResalePurchase();
  const transactionsQuery = useListResaleTransactions();
  const botQuery = useGetBotStatus();
  const items = resaleQuery.data?.supported ? resaleQuery.data.items.slice(0, 7) : [];
  const selectedItem = items.find((item) => item.slug === selectedSlug);
  const preview = previewMutation.data;
  const returnedRecipientMatches = Boolean(
    preview &&
    preview.recipientUsername.replace(/^@/, '') === AUTHORIZED_RECIPIENT_USERNAME.replace(/^@/, '') &&
    preview.recipientId === AUTHORIZED_RECIPIENT_ID,
  );
  const formReady = Boolean(
    preview?.status === 'ready' &&
    preview.supported &&
    preview.paymentFormValid &&
    preview.paymentForm,
  );
  const reportedTotal = preview?.totalStars ?? preview?.paymentForm?.totalStars ?? null;
  const verifiedBalance = botQuery.data?.balanceVerified
    ? botQuery.data.starBalance
    : preview?.botBalanceVerified && preview.botBalanceStars !== null
      ? preview.botBalanceStars
      : null;
  const payerBalance = preview?.payerBalanceStars ?? null;
  const payerBalanceSufficient = Boolean(
    preview?.payerBalanceVerified &&
    payerBalance !== null &&
    reportedTotal !== null &&
    payerBalance >= reportedTotal,
  );
  const purchaseReady = Boolean(
    formReady &&
    returnedRecipientMatches &&
    preview?.confirmationNonce &&
    reportedTotal !== null &&
    reportedTotal > 0 &&
    preview.payerBalanceVerified &&
    payerBalanceSufficient,
  );
  const giftTypes = giftTypesQuery.data?.supported ? giftTypesQuery.data.items : [];

  const resetSelectionFlow = () => {
    previewMutation.reset();
    purchaseMutation.reset();
    setConfirmationOpen(false);
    setConfirmationPhrase('');
    setConfirmationAttempted(false);
  };

  const requestPreflight = () => {
    if (!selectedItem || previewMutation.isPending) return;
    resetSelectionFlow();
    previewMutation.mutate({
      data: { giftId: selectedItem.giftId, slug: selectedItem.slug, ...(offset ? { offset } : {}) },
    });
  };

  const selectListing = (slug: string) => {
    if (purchaseMutation.isPending) return;
    setSelectedSlug(slug);
    resetSelectionFlow();
  };

  const loadNextPage = () => {
    if (purchaseMutation.isPending) return;
    const nextOffset = resaleQuery.data?.nextOffset;
    if (!nextOffset) return;
    setSelectedSlug('');
    resetSelectionFlow();
    setOffset(nextOffset);
  };

  const selectGiftType = (nextGiftId: string) => {
    setGiftId(nextGiftId);
    setOffset(undefined);
    setSelectedSlug('');
    resetSelectionFlow();
  };

  const openBuyConfirmation = () => {
    if (!purchaseReady || confirmationAttempted) return;
    setConfirmationPhrase('');
    setConfirmationOpen(true);
  };

  const confirmPurchase = () => {
    if (!selectedItem || !preview?.confirmationNonce || reportedTotal === null || !purchaseReady || confirmationPhrase !== 'BUY' || confirmationAttempted) return;
    setConfirmationAttempted(true);
    purchaseMutation.mutate({
      data: {
        giftId: selectedItem.giftId,
        slug: selectedItem.slug,
        confirmationNonce: preview.confirmationNonce,
        expectedTotalStars: reportedTotal,
        confirmationPhrase: 'BUY',
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListResaleTransactionsQueryKey() });
      },
    });
  };

  return (
    <div className="page resale-page">
      <div className="page-header resale-heading">
        <div>
          <div className="eyebrow">Telegram market / 04</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(31px, 4vw, 43px)' }}>Resale inspector</h1>
          <p className="hero-copy">Choose from Telegram’s live gift types, inspect real listings, then confirm one collectible only after its payment form and payer balance are verified.</p>
        </div>
        <div className="resale-live-mark"><span className="live-pip" /> Telegram-returned data only</div>
      </div>

      <section className="surface resale-search" data-testid="section-resale-search">
        <div className="resale-search-copy">
          <div className="surface-title">Live gift types</div>
          <div className="surface-subtitle">Gift IDs and type names come directly from Telegram.</div>
        </div>
        <div className="resale-search-form">
          <label className="field-label" htmlFor="resale-gift-type">Telegram gift type</label>
          <select
            id="resale-gift-type"
            className="text-input"
            value={giftId}
            onChange={(event) => selectGiftType(event.target.value)}
            disabled={giftTypesQuery.isLoading || !giftTypes.length || purchaseMutation.isPending}
            data-testid="input-resale-gift-type"
          >
            <option value="">{giftTypesQuery.isLoading ? 'Loading Telegram gift types…' : 'Choose a live gift type'}</option>
            {giftTypes.map((type) => (
              <option key={type.giftId} value={type.giftId}>
                {type.name} · {formatStars(type.stars)} Stars{type.soldOut ? ' · Sold out' : ''}
              </option>
            ))}
          </select>
          {giftTypesQuery.isError ? (
            <div className="input-help resale-input-error">Telegram gift types could not be loaded. <button type="button" className="inline-retry" onClick={() => giftTypesQuery.refetch()} data-testid="button-retry-gift-types">Retry</button></div>
          ) : giftTypesQuery.data && !giftTypesQuery.data.supported ? (
            <div className="input-help resale-input-error">{giftTypesQuery.data.message || 'Live gift types are unavailable for this Telegram session.'}</div>
          ) : (
            <div className="input-help">Only the selected gift type’s real live listings are requested.</div>
          )}
        </div>
      </section>

      <div className="resale-grid">
        <section className="surface resale-listings" data-testid="section-live-resale-listings">
          <div className="surface-head">
            <div>
              <div className="surface-title">Live Telegram listings</div>
              <div className="surface-subtitle">
                {giftId
                  ? `${giftTypes.find((type) => type.giftId === giftId)?.name ?? `Gift type ${giftId}`} · showing up to 7 returned listings`
                  : 'Choose a gift type to request live listings'}
              </div>
            </div>
            <div className="live-count"><span className="live-pip" /> LIVE</div>
          </div>

          {!giftId ? (
            <div className="resale-empty">
              <div className="resale-empty-icon"><Search size={20} /></div>
              <h3>Choose a Telegram gift type</h3>
              <p>Select a type above to request its current resale collectibles. No sample listings are shown here.</p>
            </div>
          ) : resaleQuery.isLoading ? (
            <div className="resale-skeleton-list" aria-label="Loading live listings">
              {[0, 1, 2].map((row) => (
                <div className="resale-skeleton-row" key={row}>
                  <div className="skeleton" style={{ width: 46, height: 46, borderRadius: 14 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '42%', height: 15 }} />
                    <div className="skeleton" style={{ width: '68%', height: 10, marginTop: 9 }} />
                  </div>
                  <div className="skeleton" style={{ width: 68, height: 13 }} />
                </div>
              ))}
            </div>
          ) : resaleQuery.isError ? (
            <div className="resale-query-error">
              <QueryError onRetry={() => resaleQuery.refetch()} message="Telegram resale data could not be retrieved. Retry the live query." />
            </div>
          ) : resaleQuery.data && !resaleQuery.data.supported ? (
            <div className="resale-empty resale-unavailable" role="status">
              <div className="resale-empty-icon"><ShieldAlert size={20} /></div>
              <h3>Live resale access unavailable</h3>
              <p>{resaleQuery.data.message || 'Telegram did not provide live listings for this request.'}</p>
              <div className="resale-honesty-note">No listings are invented when Telegram authorization or resale access is unavailable.</div>
            </div>
          ) : items.length ? (
            <>
              <div className="resale-list">
                {items.map((item, index) => (
                  <button
                    type="button"
                    className={`resale-item ${selectedSlug === item.slug ? 'selected' : ''}`}
                    key={`${item.giftId}:${item.slug}`}
                    onClick={() => selectListing(item.slug)}
                    disabled={purchaseMutation.isPending}
                    aria-pressed={selectedSlug === item.slug}
                    data-testid={`card-resale-${item.slug}`}
                  >
                    <span className="resale-item-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="resale-item-main">
                      <span className="resale-item-name">{item.name}</span>
                      <span className="resale-item-slug">{item.slug}</span>
                      <span className="resale-attributes">
                        {item.attributes.length
                          ? item.attributes.map((attribute) => (
                            <span className="attribute-chip" key={attribute.name}>
                              {attribute.name}
                            </span>
                          ))
                          : <span className="attribute-empty">No attributes returned</span>}
                      </span>
                    </span>
                    <span className="resale-item-cost">
                      <strong>{formatStars(item.priceStars)}</strong>
                      <small>Stars</small>
                      <span>Fee {item.transferFeeStars === null ? 'Unknown' : `${formatStars(item.transferFeeStars)} Stars`}</span>
                    </span>
                    <span className="resale-select-mark">{selectedSlug === item.slug ? <span /> : null}</span>
                  </button>
                ))}
              </div>
              <div className="resale-list-footer">
                <span>Listings and attributes are returned by Telegram for this query.</span>
                {resaleQuery.data?.nextOffset ? (
                  <button
                    type="button"
                    className="button-outline"
                    onClick={loadNextPage}
                    disabled={resaleQuery.isFetching || purchaseMutation.isPending}
                    data-testid="button-load-more-resale"
                  >
                    {resaleQuery.isFetching ? 'Loading…' : 'Load next live page'}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="resale-empty">
              <div className="resale-empty-icon"><Tag size={20} /></div>
              <h3>No live listings returned</h3>
              <p>{resaleQuery.data?.message || 'Telegram returned no resale collectibles for this gift type.'}</p>
            </div>
          )}
        </section>

        <aside className="surface resale-inspector" data-testid="panel-resale-preflight">
          <div className="resale-inspector-head">
            <div>
              <div className="eyebrow">Telegram preflight</div>
              <h2>Payment form</h2>
            </div>
            <span className="read-only-mark"><LockKeyhole size={14} /> Confirm separately</span>
          </div>
          <div className="resale-inspector-body">
            {selectedItem ? (
              <>
                <div className="inspected-item">
                  <div className="inspected-glyph">{selectedItem.name.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="inspected-name">{selectedItem.name}</div>
                    <div className="inspected-slug">{selectedItem.slug}</div>
                  </div>
                </div>
                <div className="preflight-facts">
                  <div className="preflight-fact"><span>Listed price</span><strong>{formatStars(selectedItem.priceStars)} Stars</strong></div>
                  <div className="preflight-fact"><span>Telegram-reported fee</span><strong>{selectedItem.transferFeeStars === null ? 'Unknown' : `${formatStars(selectedItem.transferFeeStars)} Stars`}</strong></div>
                  <div className="preflight-fact"><span>Recipient</span><strong>{AUTHORIZED_RECIPIENT_USERNAME} <span className="recipient-id">/ {AUTHORIZED_RECIPIENT_ID}</span></strong></div>
                  <div className="preflight-fact"><span>Verified bot balance</span><strong>{verifiedBalance === null ? 'Unavailable' : `${formatStars(verifiedBalance)} Stars`}</strong></div>
                  <div className="preflight-fact"><span>Authorized MTProto payer</span><strong>{preview?.payerUsername ? `${preview.payerUsername.startsWith('@') ? '' : '@'}${preview.payerUsername}` : 'Unavailable'}{preview?.payerAccountId ? <span className="recipient-id"> / {preview.payerAccountId}</span> : null}</strong></div>
                  <div className="preflight-fact"><span>MTProto payer balance</span><strong>{preview?.payerBalanceStars !== null && preview?.payerBalanceStars !== undefined ? `${formatStars(preview.payerBalanceStars)} Stars${preview.payerBalanceVerified ? ' · verified' : ' · unverified'}` : 'Unavailable'}</strong></div>
                </div>
                <button
                  type="button"
                  className="button-primary preflight-button"
                  onClick={requestPreflight}
                  disabled={!resaleQuery.data?.supported || previewMutation.isPending || purchaseMutation.isPending}
                  data-testid="button-preview-payment-form"
                >
                  {previewMutation.isPending ? <><span className="button-pulse" /> Checking Telegram form…</> : 'Refresh Telegram preflight'}
                </button>

                {previewMutation.isPending ? (
                  <div className="preflight-loading" aria-label="Checking payment form">
                    <div className="skeleton" style={{ width: '62%', height: 13 }} />
                    <div className="skeleton" style={{ width: '100%', height: 44, marginTop: 13 }} />
                  </div>
                ) : preview ? (
                  <div className={`preflight-result ${formReady ? 'ready' : 'unavailable'}`} data-testid="status-resale-preflight">
                    <div className="preflight-result-label">{formReady ? 'READY FOR AUTHORIZED PAYMENT' : 'NOT SUPPORTED / PAYMENT FORM UNAVAILABLE'}</div>
                    <p>{preview.message}</p>
                    <div className="preflight-returned">
                      {preview.resalePriceStars !== null ? <div className="preflight-fact"><span>Telegram price</span><strong>{formatStars(preview.resalePriceStars)} Stars</strong></div> : null}
                      <div className="preflight-fact"><span>Telegram fee</span><strong>{preview.transferFeeStars === null ? 'Unknown' : `${formatStars(preview.transferFeeStars)} Stars`}</strong></div>
                      {reportedTotal !== null ? <div className="preflight-fact preflight-total"><span>Exact Telegram total</span><strong>{formatStars(reportedTotal)} Stars</strong></div> : null}
                      {preview.paymentForm?.currency ? <div className="preflight-fact"><span>Form currency</span><strong>{preview.paymentForm.currency}</strong></div> : null}
                    </div>
                    {preview.paymentForm?.lines.length ? (
                      <div className="form-lines">
                        <div className="form-lines-title">Returned form lines</div>
                        {preview.paymentForm.lines.map((line, index) => (
                          <div className="preflight-fact" key={`${line.label}:${index}`}>
                            <span>{line.label}</span><strong>{formatStars(line.amountStars)} Stars</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {!returnedRecipientMatches ? (
                      <div className="recipient-warning">
                        Telegram returned a recipient that differs from {AUTHORIZED_RECIPIENT_USERNAME} / {AUTHORIZED_RECIPIENT_ID}. Buying is disabled.
                      </div>
                    ) : null}
                    {formReady ? (
                      <div className="payer-charge-note">
                        The authorized MTProto payer above is the account charged by Telegram’s <code>sendStarsForm</code> operation. The bot balance is informational only.
                      </div>
                    ) : null}
                  </div>
                ) : previewMutation.isError ? (
                  <div className="preflight-result unavailable" role="alert" data-testid="status-resale-preflight">
                    <div className="preflight-result-label">NOT SUPPORTED / PAYMENT FORM UNAVAILABLE</div>
                    <p>{previewMutation.error instanceof Error ? previewMutation.error.message : 'Telegram did not return a valid payment form preview.'}</p>
                  </div>
                ) : (
                  <div className="preflight-prompt">
                    Select a live listing, then request Telegram’s payment-form preflight. Selection itself never purchases.
                  </div>
                )}
                {preview && !previewMutation.isPending ? (
                  <>
                    <div className="buy-gate">
                      <div className="buy-gate-title">Purchase authorization</div>
                      <div className="buy-gate-copy">
                        {purchaseReady
                          ? 'Telegram returned a valid form and a verified payer balance that covers the exact total.'
                          : !formReady
                            ? 'A valid Telegram payment form is required before purchase can be enabled.'
                            : !preview.payerBalanceVerified
                              ? 'BUY is disabled until Telegram verifies the authorized payer balance.'
                              : !payerBalanceSufficient
                                ? 'The verified MTProto payer balance does not cover Telegram’s exact total.'
                                : !returnedRecipientMatches
                                  ? 'The Telegram-returned recipient does not match the configured recipient.'
                                  : 'Telegram did not return the nonce or exact total required for a safe confirmation.'}
                      </div>
                      <button
                        type="button"
                        className="button-outline buy-open-button"
                        onClick={openBuyConfirmation}
                        disabled={!purchaseReady || confirmationAttempted || purchaseMutation.isPending}
                        data-testid="button-open-buy-confirmation"
                      >
                        Continue to BUY confirmation
                      </button>
                    </div>
                    {confirmationOpen ? (
                      <div className="buy-confirmation" data-testid="section-buy-confirmation">
                        <div className="buy-confirmation-kicker">One collectible · one payment</div>
                        <h3>Confirm this Telegram charge</h3>
                        <p>Type BUY to authorize {selectedItem.name} for exactly {reportedTotal === null ? 'an unavailable total' : `${formatStars(reportedTotal)} Stars`} from the verified MTProto payer. Recipient: {AUTHORIZED_RECIPIENT_USERNAME} / {AUTHORIZED_RECIPIENT_ID}.</p>
                        <label className="field-label" htmlFor="confirm-buy-phrase">Type BUY to continue</label>
                        <input
                          id="confirm-buy-phrase"
                          className="text-input buy-phrase-input"
                          type="text"
                          autoComplete="off"
                          autoCapitalize="characters"
                          value={confirmationPhrase}
                          onChange={(event) => setConfirmationPhrase(event.target.value)}
                          disabled={confirmationAttempted || purchaseMutation.isPending}
                          data-testid="input-confirm-buy-phrase"
                        />
                        <button
                          type="button"
                          className="button-primary buy-final-button"
                          onClick={confirmPurchase}
                          disabled={!purchaseReady || confirmationPhrase !== 'BUY' || confirmationAttempted || purchaseMutation.isPending}
                          data-testid="button-confirm-resale-buy"
                        >
                          {purchaseMutation.isPending ? 'Waiting for Telegram result…' : 'BUY this collectible once'}
                        </button>
                        <button
                          type="button"
                          className="button-outline buy-cancel-button"
                          onClick={() => {
                            setConfirmationOpen(false);
                            setConfirmationPhrase('');
                          }}
                          disabled={purchaseMutation.isPending}
                          data-testid="button-cancel-buy-confirmation"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {purchaseMutation.isPending ? (
                  <div className="purchase-pending" role="status">Waiting for Telegram’s confirmed payment and delivery result.</div>
                ) : purchaseMutation.data ? (
                  <div className="purchase-result" data-testid="status-resale-purchase">
                    <div className="purchase-result-title">Telegram purchase response · {purchaseMutation.data.status}</div>
                    <p>{purchaseMutation.data.message}</p>
                    <div className="preflight-facts">
                      <div className="preflight-fact"><span>Payment confirmed</span><strong>{purchaseMutation.data.paymentConfirmed ? 'Yes' : 'No'}</strong></div>
                      <div className="preflight-fact"><span>Delivery confirmed</span><strong>{purchaseMutation.data.deliveryConfirmed ? 'Yes' : 'No'}</strong></div>
                      {purchaseMutation.data.totalStars !== null ? <div className="preflight-fact"><span>Telegram-reported total</span><strong>{formatStars(purchaseMutation.data.totalStars)} Stars</strong></div> : null}
                      {purchaseMutation.data.transactionId ? <div className="preflight-fact"><span>Transaction ID</span><strong>{purchaseMutation.data.transactionId}</strong></div> : null}
                    </div>
                  </div>
                ) : purchaseMutation.isError ? (
                  <div className="purchase-uncertain" role="alert">
                    The purchase request did not return a confirmed result. Review the persisted Telegram transaction ledger before any further action.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="resale-empty inspector-empty">
                <div className="resale-empty-icon"><ShieldCheck size={20} /></div>
                <h3>Nothing selected</h3>
                <p>The inspector stays empty until you choose a listing from Telegram’s live results.</p>
              </div>
            )}
            <div className="resale-safety-note">
              <LockKeyhole size={14} />
              <span>Listing selection and preflight do not buy. Only the final BUY action submits one confirmed collectible purchase to Telegram.</span>
            </div>
          </div>
        </aside>
      </div>

      <section className="surface resale-transaction-section" data-testid="section-resale-transactions">
        <div className="surface-head">
          <div>
            <div className="surface-title">Persisted Telegram transactions</div>
            <div className="surface-subtitle">Payment, delivery, and status are shown only from the transaction API.</div>
          </div>
          <button type="button" className="button-outline" onClick={() => transactionsQuery.refetch()} disabled={transactionsQuery.isFetching} data-testid="button-refresh-resale-transactions">
            {transactionsQuery.isFetching ? 'Refreshing…' : 'Refresh ledger'}
          </button>
        </div>
        {transactionsQuery.isLoading ? (
          <div className="resale-transaction-loading"><div className="skeleton" style={{ height: 62 }} /><div className="skeleton" style={{ height: 62, marginTop: 8 }} /></div>
        ) : transactionsQuery.isError ? (
          <div className="resale-query-error"><QueryError onRetry={() => transactionsQuery.refetch()} message="Persisted Telegram transactions could not be loaded." /></div>
        ) : transactionsQuery.data?.length ? (
          <div className="resale-transactions">
            {transactionsQuery.data.map((transaction) => (
              <article className="resale-transaction" key={transaction.id} data-testid={`row-resale-transaction-${transaction.id}`}>
                <div className="transaction-item">
                  <strong>{transaction.name}</strong>
                  <span>{transaction.slug} · gift {transaction.giftId}</span>
                  <small>{formatDate(transaction.createdAt)}</small>
                </div>
                <div className="transaction-meta">
                  <span className={`transaction-status ${transaction.status}`}>{transaction.status.replace('_', ' ')}</span>
                  <span>Payment {transaction.paymentConfirmed ? 'confirmed' : 'not confirmed'}</span>
                  <span>Delivery {transaction.deliveryConfirmed ? 'confirmed' : 'not confirmed'}</span>
                </div>
                <div className="transaction-cost">
                  <strong>{transaction.totalStars === null ? 'Total unavailable' : `${formatStars(transaction.totalStars)} Stars`}</strong>
                  <span>{transaction.recipientUsername || 'Recipient unavailable'} / {transaction.recipientId || 'ID unavailable'}</span>
                </div>
                <div className="transaction-message">
                  <span>{transaction.message}</span>
                  {transaction.telegramResult ? <small>Telegram result: {transaction.telegramResult}</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="resale-empty resale-transaction-empty">
            <div className="resale-empty-icon"><History size={20} /></div>
            <h3>No persisted resale transactions</h3>
            <p>Only results returned and saved by Telegram’s transaction API appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryPage() {
  const purchasesQuery = useListPurchases();

  if (purchasesQuery.isLoading) return <div className="page"><div className="surface" style={{ height: 300 }}><div className="skeleton" style={{ height: '100%' }} /></div></div>;
  if (purchasesQuery.isError) return <div className="page"><QueryError onRetry={() => purchasesQuery.refetch()} /></div>;

  const purchases = purchasesQuery.data ?? [];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Ledger / 02</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(31px, 4vw, 43px)' }}>Request history</h1>
          <p className="hero-copy">Every purchase request, its full Star cost, and the handoff status in one quiet ledger.</p>
        </div>
        <Link href="/" className="button-primary" style={{ width: 'auto', padding: '0 17px', textDecoration: 'none' }} data-testid="link-new-purchase">
          Browse collectibles <ArrowRight size={15} />
        </Link>
      </div>
      <section className="surface history-list" data-testid="section-history">
        {purchases.length ? (
          <>
            <div className="history-row history-labels">
              <div>Collectible</div><div>Recipient</div><div>Total</div><div>Status</div>
            </div>
            {purchases.map((purchase) => (
              <div className="history-row" key={purchase.id} data-testid={`row-purchase-${purchase.id}`}>
                <div>
                  <div className="purchase-name">{purchase.collectibleName}</div>
                  <div className="purchase-meta">{formatDate(purchase.createdAt)} · {purchase.message}</div>
                </div>
                <div className="mono">{purchase.recipientChatId}</div>
                <div className="mono">{formatStars(purchase.totalCostStars)} Stars</div>
                <div><span className={`status-chip ${purchase.status}`}>{purchase.status === 'sent' ? <Check size={11} /> : purchase.status === 'failed' ? <X size={11} /> : <Clock3 size={11} />}{statusLabel(purchase.status)}</span></div>
              </div>
            ))}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><History size={21} /></div>
            <h3>Your ledger is empty</h3>
            <p>This ledger shows Browse purchase requests only. Confirmed Telegram resale payments and delivery outcomes are listed in the Resale inspector.</p>
            <Link href="/" className="button-primary" style={{ width: 'auto', padding: '0 17px', textDecoration: 'none', marginTop: 20 }} data-testid="link-browse-empty">
              Find a collectible <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsPage() {
  const botQuery = useGetBotStatus();
  const bot = botQuery.data;

  if (botQuery.isLoading) return <div className="page"><div className="surface" style={{ height: 330 }}><div className="skeleton" style={{ height: '100%' }} /></div></div>;
  if (botQuery.isError) return <div className="page"><QueryError onRetry={() => botQuery.refetch()} /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Control room / 03</div>
          <h1 className="hero-title" style={{ fontSize: 'clamp(31px, 4vw, 43px)' }}>Settings</h1>
          <p className="hero-copy">Review the connected bot's balance and the current Telegram execution capability.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="surface settings-card" data-testid="section-read-only-settings">
          <div className="eyebrow">Execution policy</div>
            <h2 style={{ marginTop: 9 }}>Execution guardrails</h2>
            <p>Browse, request history, and transfer previews remain non-executing. The resale path can submit one collectible purchase only after Telegram validates a payment form, verifies the authorized payer balance, and the user types BUY.</p>
          <div className="capability-list">
              <div className="capability"><BadgeCheck size={17} /><div><strong>Balances stay distinct</strong><span>Bot balance is informational. A resale charge uses the verified balance of the authorized Telegram MTProto payer.</span></div></div>
              <div className="capability"><LockKeyhole size={17} /><div><strong>Explicit purchase gate</strong><span>No listing selection or preflight submits payment; one final BUY confirmation is required for a single collectible.</span></div></div>
          </div>
        </section>
        <section className="connection-banner" data-testid="section-bot-capability">
          <div className="connection-title"><MessageCircle size={17} /> Bot capability</div>
          <div className="connection-meta">{bot?.botName ?? 'Telegram bot'} · @{bot?.username ?? 'unknown'}</div>
          <div className="connection-status"><span className="status-dot" style={{ background: bot?.connected ? '#e4b13a' : '#d78371' }} />{bot?.connected ? 'Connected and responding' : 'Connection needs attention'}</div>
          {bot?.message ? <div className="message-box">{bot.message}</div> : null}
          <div className="capability-list" style={{ marginTop: 20 }}>
            <div className="capability" style={{ borderColor: 'rgba(219,236,215,.18)' }}><ShieldCheck size={17} /><div><strong style={{ color: '#eaf0de' }}>Star balance {bot?.balanceVerified ? 'verified' : 'unverified'}</strong><span style={{ color: '#9ec0ae' }}>{formatStars(bot?.starBalance ?? 0)} Stars available to the bot.</span></div></div>
            <div className="capability" style={{ borderColor: 'rgba(219,236,215,.18)' }}><Sparkles size={17} /><div><strong style={{ color: '#eaf0de' }}>Collectible gifts only</strong><span style={{ color: '#9ec0ae' }}>{bot?.collectibleGiftsOnly ? 'Ordinary gifts are excluded from the catalog.' : 'Catalog policy is not active.'}</span></div></div>
            <div className="capability" style={{ borderColor: 'rgba(219,236,215,.18)' }}><CircleAlert size={17} /><div><strong style={{ color: '#eaf0de' }}>{bot?.transactionExecutable ? 'Executable' : 'Blocked by Telegram API'}</strong><span style={{ color: '#9ec0ae' }}>{bot?.executionBlockReason}</span></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Router() {
  const botQuery = useGetBotStatus();
  return (
    <AppShell bot={botQuery.data}>
      <ErrorBoundary resetKey={window.location.pathname}>
        <Switch>
          <Route path="/">
            <BrowsePage />
          </Route>
          <Route path="/history"><HistoryPage /></Route>
          <Route path="/resale"><ResalePage /></Route>
          <Route path="/settings">
            <SettingsPage />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;