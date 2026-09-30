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
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getListCollectiblesQueryKey,
  useGetBotStatus,
  useGetDashboard,
  useListOwnedCollectibles,
  useListCollectibles,
  useListPurchases,
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
            <span className="brand-sub">buyer cockpit</span>
          </span>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-browse">
            <LayoutGrid size={16} strokeWidth={1.8} /> Browse gifts
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
            <strong>{location === '/' ? 'Browse' : location === '/history' ? 'History' : 'Settings'}</strong>
          </div>
          <div className="topbar-actions">
            <div className="balance-pill" data-testid="text-topbar-balance">
              <span className="star-token"><Coins size={10} strokeWidth={2.4} /></span>
              {bot ? formatStars(bot.starBalance) : '—'} Stars
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
            <p>This read-only dashboard does not create purchase requests or spend Stars. Use Browse to preview item prices and transfer fees.</p>
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
          <h2 style={{ marginTop: 9 }}>Planning mode only</h2>
          <p>This dashboard never sends gifts, creates purchase requests, invokes MTProto, or spends Stars.</p>
          <div className="capability-list">
            <div className="capability"><BadgeCheck size={17} /><div><strong>Balance visible</strong><span>Current bot Stars are read from Telegram and never modified here.</span></div></div>
            <div className="capability"><LockKeyhole size={17} /><div><strong>Execution blocked</strong><span>Each preview shows whether Telegram's API can execute the transaction.</span></div></div>
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