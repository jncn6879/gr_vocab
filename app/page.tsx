"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type WordType = "Noun" | "Verb" | "Adjective" | "Phrase" | "Other";

type Card = {
  id: string;
  greek: string;
  english: string;
  type: WordType;
  note: string;
  starred: boolean;
  learnedDate: string;
  wrongCount: number;
  correctCount: number;
  lastReviewed: string | null;
};

type Direction = "greek" | "english";
type ReviewSet = "today" | "yesterday" | "missed" | "starred" | "all";
const STORAGE_KEY = "lexi-greek-vocabulary-cards";

type ImportPreview = {
  cards: Card[];
  fileName: string;
  newCount: number;
  mergeCount: number;
};

const setLabels: Record<ReviewSet, string> = {
  today: "Today’s words",
  yesterday: "Yesterday",
  missed: "Needs practice",
  starred: "Favourites",
  all: "All words",
};

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function todayKey() { return localDateKey(); }
function yesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function matchesSet(card: Card, set: ReviewSet) {
  if (set === "today") return card.learnedDate === todayKey();
  if (set === "yesterday") return card.learnedDate === yesterdayKey();
  if (set === "missed") return card.wrongCount > 0 && card.wrongCount >= card.correctCount / 2;
  if (set === "starred") return card.starred;
  return true;
}

function cardKey(card: Pick<Card, "greek" | "english" | "type">) {
  return `${card.greek.trim().toLocaleLowerCase()}|${card.english.trim().toLocaleLowerCase()}|${card.type}`;
}

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return typeof card.id === "string" && typeof card.greek === "string" && typeof card.english === "string"
    && typeof card.type === "string" && typeof card.note === "string" && typeof card.starred === "boolean"
    && typeof card.learnedDate === "string" && typeof card.wrongCount === "number"
    && typeof card.correctCount === "number" && (card.lastReviewed === null || typeof card.lastReviewed === "string");
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>([]);
  const [saving, setSaving] = useState(false);
  const [set, setSet] = useState<ReviewSet>("today");
  const [direction, setDirection] = useState<Direction>("greek");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"single" | "batch">("single");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newRows, setNewRows] = useState([{ greek: "", english: "", type: "Noun" as WordType, note: "" }]);

  const loadCards = useCallback(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Card[];
        if (Array.isArray(parsed)) {
          const personalCards = parsed.filter((card) => !card.id.startsWith("demo-"));
          setCards(personalCards);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(personalCards));
        }
      }
    } catch {
      // An empty collection is still usable if browser storage is unavailable.
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  function remember(nextCards: Card[]) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCards));
  }

  const deck = useMemo(() => cards.filter((card) => matchesSet(card, set)), [cards, set]);
  const current = deck.length ? deck[index % deck.length] : null;
  const masteredCount = cards.filter((card) => card.correctCount >= 3 && card.correctCount > card.wrongCount * 2).length;
  const accuracy = cards.reduce((sum, card) => sum + card.correctCount + card.wrongCount, 0)
    ? Math.round(cards.reduce((sum, card) => sum + card.correctCount, 0) / cards.reduce((sum, card) => sum + card.correctCount + card.wrongCount, 0) * 100)
    : 0;

  function chooseSet(nextSet: ReviewSet) {
    setSet(nextSet);
    setIndex(0);
    setFlipped(false);
    setMenuOpen(false);
  }

  async function mark(result: "correct" | "wrong") {
    if (!current) return;
    const updated = cards.map((card) => card.id === current.id ? {
      ...card,
      correctCount: card.correctCount + (result === "correct" ? 1 : 0),
      wrongCount: card.wrongCount + (result === "wrong" ? 1 : 0),
      lastReviewed: new Date().toISOString(),
    } : card);
    setCards(updated);
    remember(updated);
    setFlipped(false);
    setIndex((value) => deck.length > 1 ? (value + 1) % deck.length : 0);
  }

  async function toggleStar(card: Card) {
    const updated = cards.map((item) => item.id === card.id ? { ...item, starred: !item.starred } : item);
    setCards(updated);
    remember(updated);
  }

  function exportHistory() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `lexi-history-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setTransferMessage(`${cards.length} card${cards.length === 1 ? "" : "s"} exported.`);
  }

  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportError("");
    setTransferMessage("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const incoming = Array.isArray(parsed) ? parsed : (parsed as { cards?: unknown })?.cards;
      if (!Array.isArray(incoming) || !incoming.every(isCard)) throw new Error("This is not a valid Lexi history file.");
      const localKeys = new Set(cards.map(cardKey));
      const incomingCards = incoming.filter((card) => !card.id.startsWith("demo-"));
      const uniqueIncoming = Array.from(new Map(incomingCards.map((card) => [cardKey(card), card])).values());
      const mergeCount = uniqueIncoming.filter((card) => localKeys.has(cardKey(card))).length;
      setImportPreview({ cards: uniqueIncoming, fileName: file.name, newCount: uniqueIncoming.length - mergeCount, mergeCount });
    } catch (error) {
      clearImportFile();
      setImportError(error instanceof Error ? error.message : "The selected file could not be read.");
    }
  }

  function clearImportFile() {
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function importHistory() {
    if (!importPreview) return;
    const merged = new Map(cards.map((card) => [cardKey(card), card]));
    for (const incoming of importPreview.cards) {
      const key = cardKey(incoming);
      const existing = merged.get(key);
      merged.set(key, existing ? {
        ...existing,
        note: existing.note || incoming.note,
        starred: existing.starred || incoming.starred,
        learnedDate: existing.learnedDate < incoming.learnedDate ? existing.learnedDate : incoming.learnedDate,
        wrongCount: Math.max(existing.wrongCount, incoming.wrongCount),
        correctCount: Math.max(existing.correctCount, incoming.correctCount),
        lastReviewed: [existing.lastReviewed, incoming.lastReviewed].filter(Boolean).sort().at(-1) ?? null,
      } : incoming);
    }
    const updated = Array.from(merged.values()).sort((a, b) => b.learnedDate.localeCompare(a.learnedDate));
    setCards(updated);
    remember(updated);
    setTransferMessage(`Import complete — ${importPreview.newCount} new and ${importPreview.mergeCount} matched card${importPreview.mergeCount === 1 ? "" : "s"} added safely.`);
    clearImportFile();
  }

  function updateRow(rowIndex: number, field: string, value: string) {
    setNewRows((rows) => rows.map((row, i) => i === rowIndex ? { ...row, [field]: value } : row));
  }

  function openEntry(mode: "single" | "batch" = "single") {
    setEntryMode(mode);
    setNewRows(mode === "single"
      ? [{ greek: "", english: "", type: "Noun", note: "" }]
      : Array.from({ length: 3 }, () => ({ greek: "", english: "", type: "Noun" as WordType, note: "" })));
    setEntryOpen(true);
  }

  async function saveWords(event: FormEvent) {
    event.preventDefault();
    const validRows = newRows.filter((row) => row.greek.trim() && row.english.trim());
    if (!validRows.length) return;
    setSaving(true);
    const optimistic: Card[] = validRows.map((row) => ({
      id: crypto.randomUUID(), ...row, greek: row.greek.trim(), english: row.english.trim(), starred: false,
      learnedDate: todayKey(), wrongCount: 0, correctCount: 0, lastReviewed: null,
    }));
    const updated = [...optimistic, ...cards];
    setCards(updated);
    remember(updated);
    setSaving(false);
    setNewRows([{ greek: "", english: "", type: "Noun", note: "" }]);
    setEntryOpen(false);
    chooseSet("today");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (entryOpen || libraryOpen) return;
      if (event.code === "Space") { event.preventDefault(); setFlipped((value) => !value); }
      if (flipped && event.key === "1") void mark("wrong");
      if (flipped && event.key === "2") void mark("correct");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lexi Greek home"><span className="brand-mark">λ</span><span>LEXI</span></a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <button className="nav-active">Study</button>
          <button onClick={() => setLibraryOpen(true)}>Library <span>{cards.length}</span></button>
        </nav>
        <div className="header-actions">
          <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMenuOpen((value) => !value)}>☰</button>
          <button className="add-button" onClick={() => openEntry("single")}><span>＋</span> Add a word</button>
          <button className="avatar" aria-label="Profile">JL</button>
        </div>
        {menuOpen && <div className="mobile-menu"><button onClick={() => setLibraryOpen(true)}>Open library</button><button onClick={() => openEntry("single")}>Add one word</button><button onClick={() => openEntry("batch")}>Add several words</button></div>}
      </header>

      <div className="shell" id="top">
        <section className="workspace" aria-label="Study workspace">
          <aside className="sidebar">
            <p className="section-label">STUDY SET</p>
            <div className="set-list">
              {(Object.keys(setLabels) as ReviewSet[]).map((item) => {
                const count = cards.filter((card) => matchesSet(card, item)).length;
                const icons = { today: "⌁", yesterday: "↶", missed: "↗", starred: "☆", all: "▦" };
                return <button key={item} className={set === item ? "selected" : ""} onClick={() => chooseSet(item)}><span className="set-icon">{icons[item]}</span><span>{setLabels[item]}</span><b>{count}</b></button>;
              })}
            </div>
            <div className="mini-stats">
              <div><span>{accuracy}%</span><small>Recall rate</small></div>
              <div><span>{masteredCount}</span><small>Mastered</small></div>
            </div>
          </aside>

          <section className="study-area">
            <div className="study-toolbar">
              <div>
                <p className="section-label">NOW STUDYING</p>
                <h2>{setLabels[set]} <span>{deck.length} cards</span></h2>
              </div>
              <div className="direction-toggle" aria-label="Card direction">
                <button className={direction === "greek" ? "active" : ""} onClick={() => { setDirection("greek"); setFlipped(false); }}>EL → EN</button>
                <button className={direction === "english" ? "active" : ""} onClick={() => { setDirection("english"); setFlipped(false); }}>EN → EL</button>
              </div>
            </div>

            {current ? (
              <div className="card-stage">
                <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Hide answer" : "Reveal answer"}>
                  <span className="card-number">{String((index % deck.length) + 1).padStart(2, "0")} / {String(deck.length).padStart(2, "0")}</span>
                  <span className="card-star" onClick={(event) => { event.stopPropagation(); void toggleStar(current); }} role="button" tabIndex={0} aria-label={current.starred ? "Remove favourite" : "Add favourite"}>{current.starred ? "★" : "☆"}</span>
                  {current.wrongCount > 0 && <span className="missed-badge">Missed {current.wrongCount}×</span>}
                  <span className="word-type">{flipped ? "ANSWER" : current.type.toUpperCase()}</span>
                  <strong lang={direction === "greek" && !flipped || direction === "english" && flipped ? "el" : "en"}>{direction === "greek" ? (flipped ? current.english : current.greek) : (flipped ? current.greek : current.english)}</strong>
                  {flipped && current.note && <span className="word-note">{current.note}</span>}
                  <span className="reveal-hint">{flipped ? "TAP TO SEE PROMPT" : "TAP TO REVEAL"} <kbd>SPACE</kbd></span>
                </button>
                {flipped ? (
                  <div className="answer-actions">
                    <button className="again" onClick={() => void mark("wrong")}><span>×</span><b>I got it wrong</b><small>Press 1</small></button>
                    <button className="got-it" onClick={() => void mark("correct")}><span>✓</span><b>Got it</b><small>Press 2</small></button>
                  </div>
                ) : <p className="memory-prompt">Say the answer aloud before revealing it.</p>}
              </div>
            ) : (
              <div className="empty-card"><span>λ</span><h3>No cards in this set yet.</h3><p>Add a Greek word and its meaning, then come back here to practise.</p><button className="add-button" onClick={() => openEntry("single")}>＋ Add your first word</button></div>
            )}
          </section>
        </section>

      </div>

      {entryOpen && (
        <div className="modal-backdrop" onMouseDown={() => setEntryOpen(false)}>
          <section className="modal entry-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="add-title">
            <button className="close-button" onClick={() => setEntryOpen(false)} aria-label="Close">×</button>
            <p className="eyebrow">TODAY’S COLLECTION</p><h2 id="add-title">{entryMode === "single" ? "Add one word" : "Add multiple words"}</h2><p className="modal-copy">You enter both the Greek word and its English meaning. Grammar or an example can go in the optional note.</p>
            <div className="entry-mode-toggle" aria-label="Entry mode">
              <button className={entryMode === "single" ? "active" : ""} onClick={() => { setEntryMode("single"); setNewRows([newRows[0] ?? { greek: "", english: "", type: "Noun", note: "" }]); }}>Single word</button>
              <button className={entryMode === "batch" ? "active" : ""} onClick={() => { setEntryMode("batch"); setNewRows((rows) => rows.length > 1 ? rows : [...rows, { greek: "", english: "", type: "Noun", note: "" }, { greek: "", english: "", type: "Noun", note: "" }]); }}>Multiple words</button>
            </div>
            <form onSubmit={saveWords}>
              <div className="entry-head"><span>Greek</span><span>English</span><span>Type</span><span>Note</span></div>
              {newRows.map((row, rowIndex) => <div className="entry-row" key={rowIndex}>
                <input lang="el" autoFocus={rowIndex === 0} placeholder="π.χ. όμορφος" value={row.greek} onChange={(event) => updateRow(rowIndex, "greek", event.target.value)} />
                <input placeholder="e.g. beautiful" value={row.english} onChange={(event) => updateRow(rowIndex, "english", event.target.value)} />
                <select value={row.type} onChange={(event) => updateRow(rowIndex, "type", event.target.value)}>{["Noun", "Verb", "Adjective", "Phrase", "Other"].map((type) => <option key={type}>{type}</option>)}</select>
                <input placeholder="Optional grammar or example" value={row.note} onChange={(event) => updateRow(rowIndex, "note", event.target.value)} />
              </div>)}
              {entryMode === "batch" && <button type="button" className="text-button" onClick={() => setNewRows((rows) => [...rows, { greek: "", english: "", type: "Noun", note: "" }])}>＋ Add another row</button>}
              <div className="modal-footer"><span>{entryMode === "single" ? "Your meaning, in your own words" : `${newRows.filter((row) => row.greek && row.english).length} ready to add`}</span><button className="save-button" disabled={saving}>{saving ? "Saving…" : entryMode === "single" ? "Save word" : "Save all words"} <span>→</span></button></div>
            </form>
          </section>
        </div>
      )}

      {libraryOpen && (
        <div className="modal-backdrop" onMouseDown={() => setLibraryOpen(false)}>
          <section className="modal library-modal" onMouseDown={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="library-title">
            <button className="close-button" onClick={() => setLibraryOpen(false)} aria-label="Close">×</button>
            <p className="eyebrow">YOUR COLLECTION</p><h2 id="library-title">Flashcard library</h2><p className="modal-copy">All your cards in one easy-to-scan list. Missed words are clearly marked for review.</p>
            <section className="history-tools" aria-label="Move vocabulary history between devices">
              <div className="history-copy"><strong>Move your history</strong><span>Export everything, then add it to Lexi on another device.</span></div>
              <div className="history-actions">
                <button className="secondary-button" onClick={exportHistory} disabled={!cards.length}>↓ Export history</button>
                <label className="secondary-button file-button">↑ Choose history file<input ref={fileInputRef} type="file" accept="application/json,.json" onChange={selectImportFile} /></label>
              </div>
              {importPreview && <div className="import-preview">
                <div><strong>{importPreview.fileName}</strong><span>{importPreview.newCount} new · {importPreview.mergeCount} already in this browser</span></div>
                <button className="remove-file" onClick={clearImportFile}>Remove file</button>
                <button className="save-button" onClick={importHistory}>Add to my history</button>
              </div>}
              {importError && <p className="transfer-error">{importError}</p>}
              {transferMessage && <p className="transfer-success">{transferMessage}</p>}
              <small>Imports are additive: existing cards stay, new cards are added, and matching cards keep the strongest review history.</small>
            </section>
            <div className="library-list">
              {cards.length ? cards.map((card) => <article className={`library-card ${card.wrongCount > 0 ? "has-misses" : ""}`} key={card.id}>
                <div className="library-card-top"><span>{card.type}</span><button className="library-star" onClick={() => void toggleStar(card)} aria-label={card.starred ? "Remove favourite" : "Add favourite"}>{card.starred ? "★" : "☆"}</button></div>
                <div className="library-card-words"><strong lang="el">{card.greek}</strong><span>{card.english}</span></div>
                {card.note && <p>{card.note}</p>}
                <div className="library-card-status">
                  {card.wrongCount > 0 ? <b className="needs-work">× Missed {card.wrongCount} time{card.wrongCount === 1 ? "" : "s"}</b> : <b className="new-card">Not missed yet</b>}
                  <span>✓ Correct {card.correctCount} time{card.correctCount === 1 ? "" : "s"}</span>
                </div>
              </article>) : <div className="library-empty"><span>λ</span><h3>Your library is empty</h3><p>Add your first word to create a flashcard.</p><button className="add-button" onClick={() => { setLibraryOpen(false); openEntry("single"); }}>Add a word</button></div>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
