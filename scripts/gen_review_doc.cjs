const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, TableOfContents
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'outputs', 'zoogame-refactor-plan.docx');

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  black:     '1A1A1A',
  white:     'FFFFFF',
  blue:      '1F5C99',
  lightBlue: 'D5E8F0',
  midBlue:   '2E75B6',
  green:     '2E7D32',
  lightGreen:'E8F5E9',
  amber:     'F57F17',
  lightAmber:'FFF8E1',
  red:       'C62828',
  lightRed:  'FFEBEE',
  grey:      '546E7A',
  lightGrey: 'F5F5F5',
  midGrey:   'CCCCCC',
  darkGrey:  '37474F',
};

// ── Border helpers ────────────────────────────────────────────────────────────
const border = (color = C.midGrey) => ({ style: BorderStyle.SINGLE, size: 1, color });
const allBorders = (color = C.midGrey) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: C.white });
const noAllBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });

// ── Page layout (US Letter, 1-inch margins) ───────────────────────────────────
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9360

// ── Helpers ───────────────────────────────────────────────────────────────────
const sp = (before = 0, after = 0) => ({ spacing: { before, after } });

function heading1(text, anchor) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Arial', size: 36, bold: true, color: C.blue })],
    ...sp(360, 120),
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.midBlue, space: 4 } },
    ...(anchor ? { id: anchor } : {}),
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: C.darkGrey })],
    ...sp(240, 80),
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: C.grey })],
    ...sp(160, 60),
  });
}

function para(runs, opts = {}) {
  const children = typeof runs === 'string'
    ? [new TextRun({ text: runs, font: 'Arial', size: 22, color: C.black })]
    : runs;
  return new Paragraph({ children, ...sp(80, 80), ...opts });
}

function run(text, opts = {}) {
  return new TextRun({ text, font: 'Arial', size: 22, color: C.black, ...opts });
}

function bold(text, color = C.black) {
  return new TextRun({ text, font: 'Arial', size: 22, bold: true, color });
}

function bullet(text, level = 0) {
  const indent = level === 0
    ? { left: 720, hanging: 360 }
    : { left: 1080, hanging: 360 };
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [new TextRun({ text, font: 'Arial', size: 22, color: C.black })],
    ...sp(40, 40),
    indent,
  });
}

function subbullet(text) { return bullet(text, 1); }

function callout(text, bgColor = C.lightBlue, borderColor = C.midBlue) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      borders: {
        top: noBorder(), bottom: noBorder(), right: noBorder(),
        left: { style: BorderStyle.SINGLE, size: 18, color: borderColor },
      },
      shading: { fill: bgColor, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 120 },
      width: { size: CONTENT_W, type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({ text, font: 'Arial', size: 22, color: C.black, italics: true })],
        ...sp(0, 0),
      })],
    })]})],
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () =>
    new Paragraph({ children: [new TextRun('')], ...sp(0, 0) })
  );
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ── Simple 2-column table ─────────────────────────────────────────────────────
function twoColTable(rows, colWidths = [4000, 5360], headerBg = C.blue) {
  const [w1, w2] = colWidths;
  const headerRow = new TableRow({
    tableHeader: true,
    children: [w1, w2].map((w, i) => new TableCell({
      borders: allBorders(C.midGrey),
      shading: { fill: headerBg, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({
        children: [bold(rows[0][i], C.white)],
        ...sp(0, 0),
      })],
    })),
  });

  const dataRows = rows.slice(1).map((row, ri) =>
    new TableRow({ children: row.map((cell, ci) => {
      const w = [w1, w2][ci];
      const bg = ri % 2 === 0 ? C.white : C.lightGrey;
      const content = Array.isArray(cell)
        ? cell
        : [new Paragraph({ children: [run(cell)], ...sp(0, 0) })];
      return new TableCell({
        borders: allBorders(C.midGrey),
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        width: { size: w, type: WidthType.DXA },
        children: content,
      });
    })})
  );

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ── Priority badge cell ───────────────────────────────────────────────────────
function priorityCell(label, bg, fg = C.white, w = 1440) {
  return new TableCell({
    borders: allBorders(C.midGrey),
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: w, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [bold(label, fg)],
      ...sp(0, 0),
    })],
  });
}

function textCell(text, w, bg = C.white, bold_ = false) {
  return new TableCell({
    borders: allBorders(C.midGrey),
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      children: [bold_ ? bold(text) : run(text)],
      ...sp(0, 0),
    })],
  });
}

function multilineCell(paragraphs, w, bg = C.white) {
  return new TableCell({
    borders: allBorders(C.midGrey),
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: w, type: WidthType.DXA },
    children: paragraphs,
  });
}

// ── REFACTOR PLAN TABLE ───────────────────────────────────────────────────────
// Columns: Priority | Item | Rationale | Effort | Impact
const PLAN_COL_W = [1100, 2500, 3360, 900, 1500];
const PLAN_TOTAL = PLAN_COL_W.reduce((a, b) => a + b, 0);

function planTable(rows) {
  const headers = ['Priority', 'Item', 'Rationale', 'Effort', 'Impact'];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders: allBorders(C.midGrey),
      shading: { fill: C.blue, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: PLAN_COL_W[i], type: WidthType.DXA },
      children: [new Paragraph({ children: [bold(h, C.white)], ...sp(0, 0) })],
    })),
  });

  const dataRows = rows.map((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.lightGrey;
    const [priorityLabel, priorityBg] = row.priority;
    return new TableRow({ children: [
      priorityCell(priorityLabel, priorityBg, C.white, PLAN_COL_W[0]),
      textCell(row.item, PLAN_COL_W[1], bg, true),
      multilineCell(
        row.rationale.map(t => new Paragraph({ children: [run(t)], ...sp(0, 40) })),
        PLAN_COL_W[2], bg
      ),
      textCell(row.effort, PLAN_COL_W[3], bg),
      textCell(row.impact, PLAN_COL_W[4], bg),
    ]});
  });

  return new Table({
    width: { size: PLAN_TOTAL, type: WidthType.DXA },
    columnWidths: PLAN_COL_W,
    rows: [headerRow, ...dataRows],
  });
}

const P1 = ['P1', C.red];
const P2 = ['P2', C.amber];
const P3 = ['P3', C.green];
const P4 = ['P4', C.grey];

// ── FILE TABLE ────────────────────────────────────────────────────────────────
function fileTable() {
  const COL = [2800, 800, 3160, 2600];
  const TOTAL = COL.reduce((a, b) => a + b, 0);
  const rows = [
    ['File', 'Lines', 'Role', 'Quality'],
    ['src/main.js', '26', 'Game entry point — Phaser config', 'Excellent: minimal, correct'],
    ['src/scenes/PlaygroundScene.js', '1,422', 'World state, terrain, physics, scoring, UI, camera, decorations', 'Needs refactor: too large, mixes responsibilities'],
    ['src/objects/Elephant.js', '305', 'Player input, movement, animation', 'Good: well-structured, update() too long'],
    ['src/objects/TouchControls.js', '255', 'Mobile on-screen analog stick and buttons', 'Good: self-contained, minor duplication'],
    ['src/util/textures.js', '236', 'Runtime texture generation — all game art', 'Excellent: creative, efficient, consistent'],
    ['src/util/sounds.js', '131', 'Web Audio API synthesis — all sound effects', 'Good effects, hard to tune'],
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: rows[0].map((h, i) => new TableCell({
      borders: allBorders(C.midGrey),
      shading: { fill: C.blue, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: COL[i], type: WidthType.DXA },
      children: [new Paragraph({ children: [bold(h, C.white)], ...sp(0, 0) })],
    })),
  });

  const dataRows = rows.slice(1).map((row, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.lightGrey;
    return new TableRow({ children: row.map((cell, ci) => new TableCell({
      borders: allBorders(C.midGrey),
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: COL[ci], type: WidthType.DXA },
      children: [new Paragraph({ children: [run(cell)], ...sp(0, 0) })],
    }))});
  });

  return new Table({
    width: { size: TOTAL, type: WidthType.DXA },
    columnWidths: COL,
    rows: [headerRow, ...dataRows],
  });
}

// ── ISSUE TABLE ───────────────────────────────────────────────────────────────
function issueTable(issues) {
  const COL = [3200, 3000, 3160];
  const TOTAL = COL.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Issue', 'Location', 'Detail'].map((h, i) => new TableCell({
      borders: allBorders(C.midGrey),
      shading: { fill: C.darkGrey, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      width: { size: COL[i], type: WidthType.DXA },
      children: [new Paragraph({ children: [bold(h, C.white)], ...sp(0, 0) })],
    })),
  });

  const dataRows = issues.map((issue, ri) => {
    const bg = ri % 2 === 0 ? C.white : C.lightGrey;
    return new TableRow({ children: [
      new TableCell({
        borders: allBorders(C.midGrey), shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 }, width: { size: COL[0], type: WidthType.DXA },
        children: [new Paragraph({ children: [bold(issue[0])], ...sp(0, 0) })],
      }),
      new TableCell({
        borders: allBorders(C.midGrey), shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 }, width: { size: COL[1], type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: issue[1], font: 'Courier New', size: 18, color: C.darkGrey })], ...sp(0, 0) })],
      }),
      new TableCell({
        borders: allBorders(C.midGrey), shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 }, width: { size: COL[2], type: WidthType.DXA },
        children: [new Paragraph({ children: [run(issue[2])], ...sp(0, 0) })],
      }),
    ]});
  });

  return new Table({
    width: { size: TOTAL, type: WidthType.DXA },
    columnWidths: COL,
    rows: [headerRow, ...dataRows],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ═════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: C.blue },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: C.darkGrey },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: C.grey },
        paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 } },
    ],
  },

  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({ children: [
        new Paragraph({
          children: [
            bold('Project Canopy (zoogame)', C.blue),
            run('  —  Code Review & Refactor Plan', { color: C.grey }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.midGrey, space: 4 } },
          ...sp(0, 60),
        }),
      ]}),
    },
    footers: {
      default: new Footer({ children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            run('Page ', { color: C.grey }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 22, color: C.grey }),
            run(' of ', { color: C.grey }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 22, color: C.grey }),
          ],
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.midGrey, space: 4 } },
          ...sp(60, 0),
        }),
      ]}),
    },
    children: [

      // ── COVER ──────────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Project Canopy', font: 'Arial', size: 64, bold: true, color: C.blue })],
        ...sp(480, 80),
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Code Review & Refactor Plan', font: 'Arial', size: 36, color: C.darkGrey })],
        ...sp(0, 40),
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'June 2026', font: 'Arial', size: 24, color: C.grey, italics: true })],
        ...sp(0, 480),
      }),

      // Summary callout on cover
      new Table({
        width: { size: 7200, type: WidthType.DXA },
        columnWidths: [7200],
        rows: [new TableRow({ children: [new TableCell({
          borders: allBorders(C.midBlue),
          shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          width: { size: 7200, type: WidthType.DXA },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [bold('Executive Summary', C.blue)], ...sp(0, 80) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Project Canopy is a well-crafted browser game built on Phaser 3 / Matter.js. ')], ...sp(0, 0) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Core game-feel is excellent; the primary structural issue is a single 1,422-line')], ...sp(0, 0) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [run('scene class that accumulates every subsystem. This document identifies twelve')], ...sp(0, 0) }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [run('code quality issues and presents a prioritised, incremental refactor plan.')], ...sp(0, 0) }),
          ],
        })]}),
        ],
      }),

      pageBreak(),

      // ── TABLE OF CONTENTS ──────────────────────────────────────────────────
      new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 1. OVERVIEW
      // ══════════════════════════════════════════════════════════════════════
      heading1('1. Codebase Overview'),

      para([bold('Stack: '), run('Phaser 3.80 (Canvas/WebGL), Matter.js physics (bundled), Vite 5.4 bundler, vanilla ES2020 JavaScript. No TypeScript, no UI framework, no external assets for game objects.')]),
      ...spacer(1),

      heading2('1.1 File Inventory'),
      fileTable(),
      ...spacer(1),

      heading2('1.2 Architecture at a Glance'),
      para('The game runs as a single Phaser scene. Initialization builds procedural terrain and platforms; the update loop drives input, movement, decorations and idle-detection every frame; Matter.js emits collision events that the scene routes to scoring, bouncing and kick logic.'),
      ...spacer(1),

      twoColTable([
        ['Subsystem', 'Where it lives'],
        ['Game entry / Phaser config', 'src/main.js'],
        ['Terrain generation & extension', 'PlaygroundScene — buildGround(), generateChunkTerrainHeights(), extendWorld()'],
        ['Platform placement', 'PlaygroundScene — buildPlatforms(), spawnPlatformCluster(), resolveOverlap()'],
        ['Scoring & world growth', 'PlaygroundScene — onGoalScored(), restartLevel(), celebrateGoal()'],
        ['Physics collision dispatch', 'PlaygroundScene — matter:collisionstart listener'],
        ['Camera & indicator arrows', 'PlaygroundScene — create() camera block, updateIndicatorArrows()'],
        ['HUD & UI', 'PlaygroundScene — scoreText, fruitIdleText, controller dropdown'],
        ['Decorations (clouds, birds, palms)', 'PlaygroundScene — buildPalms(), updateClouds(), updateBirds()'],
        ['Player input & movement', 'src/objects/Elephant.js'],
        ['Touch controls', 'src/objects/TouchControls.js'],
        ['Procedural art', 'src/util/textures.js'],
        ['Procedural audio', 'src/util/sounds.js'],
      ], [3600, 5760]),
      ...spacer(1),

      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 2. STRENGTHS
      // ══════════════════════════════════════════════════════════════════════
      heading1('2. Strengths'),

      para('The following areas are well-executed and should be preserved or used as a model in refactoring.'),
      ...spacer(1),

      heading2('2.1 Procedural Art and Audio'),
      para('All game visuals (platforms, fruit, goal, decorations, UI elements) are generated at runtime using the Phaser Graphics API. This eliminates an asset pipeline entirely, produces a consistent thick-outline aesthetic, and keeps the bundle small. The Web Audio synthesis in sounds.js layers four frequency bands to produce satisfying impact sounds with velocity-scaled volume.'),
      ...spacer(1),

      heading2('2.2 Well-Named Constants'),
      para('PlaygroundScene opens with approximately 50 named constants covering terrain shape, platform placement rules, physics feel and world growth rates. This means most tuning is a single-line edit at the top of the file rather than a buried literal.'),
      ...spacer(1),

      heading2('2.3 Unified Input Abstraction'),
      para([
        run('Elephant.js consolidates keyboard, gamepad and touch into a single normalised interface ('),
        new TextRun({ text: 'left, right, jumpJustPressed, dashHeld', font: 'Courier New', size: 20, color: C.darkGrey }),
        run('). The gamepad "justDown" limitation in Phaser is worked around cleanly with a per-button state map. All three input paths are multi-touch-aware.'),
      ]),
      ...spacer(1),

      heading2('2.4 Label-Based Collision Dispatch'),
      para([
        run('Every Matter body receives a '),
        new TextRun({ text: 'label', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' immediately after creation. The collision handler pattern-matches on these labels rather than holding object references, which makes the system robust to bodies being destroyed and re-created (as happens on every goal score).'),
      ]),
      ...spacer(1),

      heading2('2.5 Non-Destructive World Growth'),
      para('When a goal is scored the world widens by 300 px and terrain amplitude increases by 15 px. The new chunk slides in smoothly from below while the existing terrain is preserved. This incremental approach avoids a jarring full-level restart while delivering a genuine difficulty ramp.'),
      ...spacer(1),

      heading2('2.6 Smooth Terrain Seaming'),
      para('Adjacent terrain chunks blend over 5 segments (~300 px) by locking wave phases across chunk boundaries and drifting wavelengths gradually toward new targets. The result is visually seamless despite being generated in independent calls.'),
      ...spacer(1),

      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 3. ISSUES
      // ══════════════════════════════════════════════════════════════════════
      heading1('3. Code Quality Issues'),

      para('Twelve issues are identified below, grouped by theme. None are critical bugs; all are maintainability or extensibility concerns.'),
      ...spacer(1),

      // ── 3.1 Monolith ──
      heading2('3.1 Monolithic Scene Class'),

      callout(
        'PlaygroundScene.js is 1,422 lines and handles terrain generation, platform placement, physics collision dispatch, scoring, world growth, camera, HUD, decorations, and fruit idle detection simultaneously.',
        C.lightRed, C.red
      ),
      ...spacer(1),

      para('This is the single largest structural problem. Every subsystem is a set of methods and instance variables on the same class, making it hard to:'),
      bullet('navigate — finding the platform spawner requires scrolling past terrain code and collision handlers'),
      bullet('test — any test of platform placement must construct a full scene'),
      bullet('extend — adding a new decoration type means editing the same file as physics tuning'),
      bullet('reason about — instance variable ownership is unclear (who owns this.terrainPoints?)'),
      ...spacer(1),

      para('The recommended split is five classes, each with a single clear responsibility (see Section 4 for the refactor plan).'),
      ...spacer(1),

      // ── 3.2 Timing chain ──
      heading2('3.2 Fragile Goal-Scoring Timing Chain'),

      callout(
        'Five independent visual events (score flash, GOAL! text, terrain slide, fruit respawn, crate rain) are sequenced with hardcoded millisecond delays. A change to one duration silently breaks the visual sequence.',
        C.lightAmber, C.amber
      ),
      ...spacer(1),

      para([bold('Where: '), run('PlaygroundScene.onGoalScored(), celebrateGoal() — approximately lines 295–390.')]),
      para('The terrain slide tween runs for 700 ms. Crate drops are staggered starting at 700 ms after the goal. If the tween duration is adjusted, the crates appear to fall at the wrong moment relative to the terrain. No callback or event links these two timings.'),
      para([bold('Fix: '), run('Use a Phaser tween onComplete callback or a simple event emitter so each stage starts only when the previous stage finishes, rather than relying on matching hardcoded numbers.')]),
      ...spacer(1),

      // ── 3.3 Platform overlap ──
      heading2('3.3 Dense Platform Overlap Resolution'),

      callout(
        'resolveOverlap() is 55 lines of nested loops with no explanatory comments. The four-direction escape heuristic has no guaranteed convergence and silently returns the best-found position when the iteration limit is hit.',
        C.lightAmber, C.amber
      ),
      ...spacer(1),

      para([bold('Where: '), run('PlaygroundScene.resolveOverlap() — approximately lines 696–750.')]),
      para('The algorithm tries 20 random placements first, then falls back to 30 deterministic escape iterations. The escape directions (up, down, left, right) are calculated correctly but are completely undocumented. An edge case with many high-angle platforms on a small world could leave two platforms slightly overlapping.'),
      para([bold('Fix: '), run('Add a JSDoc comment explaining the two-phase approach, name the escape directions as constants, and add a guard that logs a warning and skips placement if the iteration limit is hit without convergence.')]),
      ...spacer(1),

      // ── 3.4 Magic numbers in logic ──
      heading2('3.4 Magic Numbers in Non-Constant Locations'),

      para('Most tuning values are correctly declared at the top of PlaygroundScene. However, several magic numbers appear embedded in method bodies where they are harder to find:'),
      ...spacer(1),

      issueTable([
        ['Flash timing (120 ms, 1200 ms)', 'PlaygroundScene ~line 302', 'Goal flash interval and total duration; not in constants block'],
        ['GOAL! text style (120px, stroke 10)', 'PlaygroundScene ~line 319', 'Font size and stroke hardcoded in tween definition'],
        ['Palm spacing (560 px, jitter 90 px)', 'PlaygroundScene ~line 1047', 'Decoration spacing not in top constants block'],
        ['Bird flap interval (180 ms)', 'PlaygroundScene ~line 1145', 'Defined inside updateBirds() instead of at top of file'],
        ['Surface angle lerp (0.18)', 'Elephant.js ~line 287', 'Unnamed lerp coefficient; effect unclear without experimentation'],
        ['Gamepad button indices (0, 1, 2, 3)', 'Elephant.js ~lines 134-136', 'Used as bare integers; comment lists mapping but not enforced'],
        ['Bounce volume floor (0.05)', 'sounds.js line 11', 'Silence threshold not a named constant'],
        ['Noise buffer patterns', 'sounds.js lines 55-94', 'Frequency and timing ramps entirely undocumented'],
      ]),
      ...spacer(1),

      // ── 3.5 Scattered state ──
      heading2('3.5 State Scattered Across Scene Fields'),

      para('Related state for the same game concept is spread across many disconnected instance variables on PlaygroundScene:'),
      ...spacer(1),

      twoColTable([
        ['Concept', 'Scattered fields'],
        ['Fruit', 'this.fruit, this.fruitType, this.fruitIdleTime, this.fruitIdleText, fruitArrow'],
        ['Terrain', 'this.terrainPoints, this.groundBodies, this.groundGraphicsObjects, terrainWaveState, terrainAmplitude'],
        ['Platforms', 'this.platforms, this.platformArrows (array)'],
        ['Score / World', 'this.score, this.worldWidth, this.scoreText'],
      ], [3000, 6360]),
      ...spacer(1),
      para('Grouping these into dedicated manager objects (FruitManager, TerrainManager, etc.) would make ownership explicit and simplify restartLevel(), which currently must reset each field individually.'),
      ...spacer(1),

      // ── 3.6 Input inconsistency ──
      heading2('3.6 Input Dead-Zone Inconsistency'),

      para([
        run('Three separate dead-zone values exist for three input paths, using different units and names: '),
        new TextRun({ text: 'STICK_DEAD = 0.2', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' (normalised, in Elephant.js), '),
        new TextRun({ text: 'STICK_DEAD_ZONE = 12', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' (pixels, in TouchControls.js). Keyboard is inherently digital. Adjusting feel for one path has no effect on the others, and the shared-looking names cause confusion about which unit is in use.'),
      ]),
      ...spacer(1),

      // ── 3.7 Collision handler ──
      heading2('3.7 Collision Handler as a Monolithic Listener'),

      para([
        run('All collision types are resolved inside one '),
        new TextRun({ text: 'matter:collisionstart', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' listener (~25 lines). Adding a new collision type requires editing this block and being careful not to break existing branches. A dispatch table mapping label pairs to handler functions would make additions safe and isolated.'),
      ]),
      ...spacer(1),

      // ── 3.8 Missing JSDoc ──
      heading2('3.8 Missing JSDoc on Complex Methods'),

      para('The most complex methods in the codebase have no documentation:'),
      bullet('generateChunkTerrainHeights() — 90 lines of wave generation and blending'),
      bullet('spawnPlatformCluster() — recursive cluster spawner with depth decay'),
      bullet('resolveOverlap() — two-phase overlap resolution heuristic'),
      bullet('updateBirds() — frame-based wing animation state machine'),
      bullet('bounceFruitOffPlatform() — physics impulse calculation with platform angle'),
      ...spacer(1),
      para('Elephant.js and TouchControls.js are better documented through variable names but still lack method-level docstrings. sounds.js has no documentation of frequency choices or timing rationale.'),
      ...spacer(1),

      // ── 3.9 Wind streaks ──
      heading2('3.9 Wind Streak Rendering in Player Class'),

      para([
        run('Elephant.js creates a '),
        new TextRun({ text: 'Phaser.GameObjects.Graphics', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' object and redraws it every frame during a dash. This is a visual effect, not gameplay logic, and its presence in the input/movement class blurs the class responsibility. It is also mildly inefficient — clear-and-redraw every frame at 60 FPS is fine for one effect but sets a precedent that does not scale.'),
      ]),
      ...spacer(1),

      // ── 3.10 postUpdate contract ──
      heading2('3.10 Fragile postUpdate() Contract in TouchControls'),

      para([
        new TextRun({ text: 'TouchControls.postUpdate()', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' must be called every frame to clear '),
        new TextRun({ text: 'jumpJustPressed', font: 'Courier New', size: 20, color: C.darkGrey }),
        run('. If PlaygroundScene forgets this call, jump becomes permanently sticky. There is no mechanism to enforce the contract. An alternative is to clear the flag automatically inside the '),
        new TextRun({ text: 'pointerup', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' handler after one consumption, or to expose a '),
        new TextRun({ text: 'consumeJump()', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' method that clears the flag when read.'),
      ]),
      ...spacer(1),

      // ── 3.11 pngjs unused ──
      heading2('3.11 Unused Dependency'),

      para([
        new TextRun({ text: 'pngjs ^7.0.0', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' is listed in package.json devDependencies but is not imported anywhere in the codebase. It should be removed to keep the dependency list honest.'),
      ]),
      ...spacer(1),

      // ── 3.12 No bounds guard ──
      heading2('3.12 Missing Guard in getTerrainYAt()'),

      para([
        new TextRun({ text: 'getTerrainYAt(x)', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' assumes '),
        new TextRun({ text: 'this.terrainPoints', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' is populated. If called before '),
        new TextRun({ text: 'buildGround()', font: 'Courier New', size: 20, color: C.darkGrey }),
        run(' — e.g., during an accidental early update tick — it will throw a silent runtime error. A one-line guard or assertion would surface this clearly.'),
      ]),
      ...spacer(1),

      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 4. REFACTOR PLAN
      // ══════════════════════════════════════════════════════════════════════
      heading1('4. Prioritised Refactor Plan'),

      para('Work items are ordered by value-to-effort ratio. P1 items fix the largest structural problems. P2 items significantly improve day-to-day maintainability. P3 items are polish. P4 items are minor cleanups that can be done opportunistically.'),
      ...spacer(1),

      callout(
        'All refactors can be done incrementally. Each item is self-contained and can be merged independently. None require changing game behaviour.',
        C.lightGreen, C.green
      ),
      ...spacer(1),

      heading2('4.1 Priority Summary'),

      planTable([
        {
          priority: P1,
          item: 'Extract TerrainManager',
          rationale: [
            'buildGround(), generateChunkTerrainHeights(), extendWorld(), getTerrainYAt() and all terrain state (terrainPoints, groundBodies, graphicsObjects, terrainWaveState, terrainAmplitude) move to a dedicated class.',
            'This is the largest single extraction and reduces PlaygroundScene by ~250 lines.',
          ],
          effort: 'Medium',
          impact: 'High',
        },
        {
          priority: P1,
          item: 'Extract PlatformSpawner',
          rationale: [
            'buildPlatforms(), spawnPlatformCluster(), getPlatformBounds(), resolveOverlap() and platform state move out.',
            'Allows the overlap algorithm to be tested in isolation and documented properly.',
          ],
          effort: 'Medium',
          impact: 'High',
        },
        {
          priority: P1,
          item: 'Fix goal-scoring timing chain',
          rationale: [
            'Replace hardcoded delay offsets with tween onComplete callbacks and a simple event sequence.',
            'Prevents visual desync when any tween duration is adjusted.',
          ],
          effort: 'Small',
          impact: 'Medium',
        },
        {
          priority: P2,
          item: 'Extract CollisionHandler',
          rationale: [
            'Move the collisionstart listener to its own class with a label-pair dispatch table.',
            'New collision types become additive rather than requiring edits to an existing block.',
          ],
          effort: 'Small',
          impact: 'Medium',
        },
        {
          priority: P2,
          item: 'Extract UIManager',
          rationale: [
            'scoreText, fruitIdleText, indicator arrows, controller dropdown, and GOAL! animation move to one class.',
            'PlaygroundScene stops owning display objects unrelated to physics.',
          ],
          effort: 'Medium',
          impact: 'Medium',
        },
        {
          priority: P2,
          item: 'Extract DecorationManager',
          rationale: [
            'buildPalms(), updateClouds(), updateBirds() and decoration state move out.',
            'Decorations are entirely cosmetic; separating them means touching 0 gameplay code when tweaking visuals.',
          ],
          effort: 'Small',
          impact: 'Medium',
        },
        {
          priority: P2,
          item: 'Add JSDoc to complex methods',
          rationale: [
            'generateChunkTerrainHeights(), spawnPlatformCluster(), resolveOverlap(), bounceFruitOffPlatform(), updateBirds().',
            'Reduces onboarding time and makes intent clear before code is read.',
          ],
          effort: 'Small',
          impact: 'Medium',
        },
        {
          priority: P2,
          item: 'Move remaining magic numbers to constants',
          rationale: [
            'Flash timings, GOAL! text style, palm spacing, bird flap interval, surface angle lerp, gamepad button indices.',
            'All tuning in one place; no need to grep method bodies.',
          ],
          effort: 'Small',
          impact: 'Low',
        },
        {
          priority: P3,
          item: 'Consolidate input dead-zone handling',
          rationale: [
            'Single STICK_DEAD_ZONE constant shared across TouchControls and Elephant; documented unit (normalised).',
            'Tuning feel for analogue input becomes a one-variable change.',
          ],
          effort: 'Small',
          impact: 'Low',
        },
        {
          priority: P3,
          item: 'Replace postUpdate() contract with consumeJump()',
          rationale: [
            'TouchControls exposes consumeJump() that returns the flag and clears it. Elephant calls it once per frame.',
            'Eliminates the "must call postUpdate every frame or jump sticks" footgun.',
          ],
          effort: 'Small',
          impact: 'Low',
        },
        {
          priority: P3,
          item: 'Move wind-streak effect out of Elephant',
          rationale: [
            'Extract wind streak rendering to a DashEffect helper owned by the scene.',
            'Elephant becomes pure input/movement; visual effects can be changed without touching physics code.',
          ],
          effort: 'Small',
          impact: 'Low',
        },
        {
          priority: P3,
          item: 'Add sounds.js constants and comments',
          rationale: [
            'Document frequency choices (why 620 Hz, why 180 Hz low-pass), name volume gains as constants, expose a master volume multiplier.',
            'Makes audio tuning approachable without Web Audio API expertise.',
          ],
          effort: 'Small',
          impact: 'Low',
        },
        {
          priority: P4,
          item: 'Remove pngjs dependency',
          rationale: ['npm uninstall pngjs — it is imported nowhere.'],
          effort: 'Trivial',
          impact: 'Low',
        },
        {
          priority: P4,
          item: 'Guard getTerrainYAt() against missing points',
          rationale: [
            'if (!this.terrainPoints?.length) throw new Error("Terrain not built") — one line.',
            'Surfaces initialisation-order bugs immediately instead of silently.',
          ],
          effort: 'Trivial',
          impact: 'Low',
        },
        {
          priority: P4,
          item: 'Add resolveOverlap() convergence warning',
          rationale: [
            'Log a console.warn when the iteration limit is hit without convergence.',
            'Makes edge-case platform placement failures visible during development.',
          ],
          effort: 'Trivial',
          impact: 'Low',
        },
      ]),

      ...spacer(1),
      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 5. PROPOSED MODULE STRUCTURE
      // ══════════════════════════════════════════════════════════════════════
      heading1('5. Proposed Module Structure'),

      para('After completing the P1 and P2 extractions, the source tree would look like this:'),
      ...spacer(1),

      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          borders: allBorders(C.midGrey),
          shading: { fill: C.lightGrey, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          width: { size: CONTENT_W, type: WidthType.DXA },
          children: [
            'src/',
            '  main.js                        (unchanged)',
            '  scenes/',
            '    PlaygroundScene.js           (~300 lines — orchestration only)',
            '  objects/',
            '    Elephant.js                  (unchanged)',
            '    TouchControls.js             (unchanged)',
            '  managers/',
            '    TerrainManager.js            (terrain gen, bodies, graphics, queries)',
            '    PlatformSpawner.js           (cluster spawn, overlap resolution)',
            '    CollisionHandler.js          (dispatch table for physics events)',
            '    UIManager.js                 (HUD, indicator arrows, GOAL! animation)',
            '    DecorationManager.js         (clouds, birds, palms)',
            '    FruitManager.js              (spawn, idle timer, respawn)',
            '  util/',
            '    textures.js                  (unchanged)',
            '    sounds.js                    (constants added)',
            '    constants.js                 (shared constants — dead zones, etc.)',
          ].map(line => new Paragraph({
            children: [new TextRun({ text: line, font: 'Courier New', size: 18, color: C.darkGrey })],
            ...sp(0, 0),
          })),
        })]}),
        ],
      }),

      ...spacer(1),
      para('PlaygroundScene becomes an orchestrator: it creates the managers, passes them to each other where needed (e.g., CollisionHandler receives TerrainManager and FruitManager), and calls their update methods each frame. No gameplay logic lives in the scene itself.'),
      ...spacer(1),

      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 6. SUGGESTED SEQUENCING
      // ══════════════════════════════════════════════════════════════════════
      heading1('6. Suggested Implementation Sequence'),

      para('Each step below is independently mergeable and does not break existing behaviour.'),
      ...spacer(1),

      twoColTable([
        ['Step', 'Work'],
        ['1', 'Remove pngjs (P4, trivial — good warm-up, confirms CI works)'],
        ['2', 'Move remaining magic numbers to constants block in PlaygroundScene (P2)'],
        ['3', 'Add JSDoc comments to the five undocumented complex methods (P2)'],
        ['4', 'Add sounds.js constants and document frequency rationale (P3)'],
        ['5', 'Fix goal-scoring timing chain with onComplete callbacks (P1)'],
        ['6', 'Extract TerrainManager — copy methods, update all callers, delete originals (P1)'],
        ['7', 'Extract PlatformSpawner (P1)'],
        ['8', 'Extract FruitManager — fruit spawn, idle timer, respawn (P2)'],
        ['9', 'Extract CollisionHandler with dispatch table (P2)'],
        ['10', 'Extract UIManager — HUD, arrows, GOAL! animation (P2)'],
        ['11', 'Extract DecorationManager — clouds, birds, palms (P2)'],
        ['12', 'Consolidate dead-zone handling; replace postUpdate() with consumeJump() (P3)'],
        ['13', 'Move wind-streak effect to DashEffect helper (P3)'],
        ['14', 'Add getTerrainYAt() guard; add resolveOverlap() convergence warning (P4)'],
      ], [600, 8760]),

      ...spacer(1),
      callout(
        'Steps 6-11 (the manager extractions) are the most time-consuming but can be done in any order. Each extraction can be verified by running the game and checking that feel, scoring, terrain growth and decorations are unchanged.',
        C.lightBlue, C.midBlue
      ),
      ...spacer(1),

      pageBreak(),

      // ══════════════════════════════════════════════════════════════════════
      // 7. SUMMARY SCORECARD
      // ══════════════════════════════════════════════════════════════════════
      heading1('7. Summary Scorecard'),

      ...spacer(1),

      twoColTable([
        ['Dimension', 'Assessment'],
        ['Correctness', 'No critical bugs found. Physics, scoring, and world growth logic are correct.'],
        ['Code organisation', 'Needs work — one file handles eight distinct subsystems.'],
        ['Naming', 'Good in constants and variables; gamepad button indices and dead-zone names are exceptions.'],
        ['Documentation', 'Thin — complex algorithms have no JSDoc; sounds.js has no rationale comments.'],
        ['Test coverage', 'None. All validation is manual in-browser.'],
        ['Extensibility', 'Low for collisions and decorations; good for terrain tuning (constants-driven).'],
        ['Dependencies', 'Minimal and appropriate; one unused package (pngjs) to remove.'],
        ['Game feel', 'Excellent — physics tuning, procedural art, and audio are high quality.'],
        ['Overall rating', 'Good prototype, needs structural refactor before the codebase grows further.'],
      ], [3000, 6360]),

      ...spacer(1),
      ...spacer(1),

      para([
        bold('Bottom line: '),
        run('Project Canopy has excellent game feel and a sound high-level architecture. The primary risk is that PlaygroundScene will become increasingly difficult to change as the game grows. The refactor plan above, if completed in sequence, will reduce the scene to an orchestrator of well-defined managers, bring the codebase to a maintainable state, and make future feature development faster and less risky.'),
      ]),

    ], // end children
  }], // end sections
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('Written:', OUT);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
