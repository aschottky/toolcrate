import PDFDocument from "pdfkit";

const BRAND = {
  primary: "#1a222d",
  accent: "#e85d2a",
  muted: "#4a5568",
  light: "#f4f1eb",
  white: "#ffffff",
};

const CATEGORIES = [
  { key: "seo", label: "SEO" },
  { key: "leadCapture", label: "Lead Capture" },
  { key: "mobileFriendliness", label: "Mobile-Friendliness" },
];

/** Right column reserved for score — keeps summary text from overlapping */
const SCORE_COLUMN_WIDTH = 80;
const CARD_PADDING = 16;
const BADGE_SIZE = 24;

/**
 * Build a professional audit PDF and return it as a Buffer (for email attachments).
 *
 * @param {object} reportData - Output from runSiteAudit
 * @param {string} websiteUrl - Audited site URL
 * @returns {Promise<Buffer>}
 */
export function generateAuditPDF(reportData, websiteUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      info: {
        Title: "Website Tear Down Audit",
        Author: "Website Tear Down",
        Subject: `Audit for ${websiteUrl}`,
      },
    });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawHeader(doc, websiteUrl);
      drawScores(doc, reportData);
      drawTips(doc, reportData.tips);

      if (reportData.markdown?.trim()) {
        drawMarkdownSection(doc, reportData.markdown);
      }

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawHeader(doc, websiteUrl) {
  doc
    .fillColor(BRAND.accent)
    .fontSize(10)
    .text("WEBSITE TEAR DOWN", { align: "left" });

  doc.moveDown(0.4);

  doc.fillColor(BRAND.primary).fontSize(26).text("Website Tear Down Audit", {
    align: "left",
  });

  doc.moveDown(0.6);

  doc.fillColor(BRAND.muted).fontSize(11).text("Audited website", { continued: false });

  doc
    .fillColor(BRAND.primary)
    .fontSize(12)
    .text(websiteUrl, { link: websiteUrl, underline: true });

  doc.moveDown(0.3);

  doc
    .fillColor(BRAND.muted)
    .fontSize(10)
    .text(
      `Generated ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`
    );

  doc.moveDown(1.2);

  doc
    .strokeColor(BRAND.accent)
    .lineWidth(2)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();

  doc.moveDown(1);
}

function drawScores(doc, reportData) {
  doc.fillColor(BRAND.primary).fontSize(14).text("Score summary");
  doc.moveDown(0.8);

  for (const { key, label } of CATEGORIES) {
    const section = reportData[key];
    if (!section) continue;

    drawScoreCard(doc, label, section.score, section.summary);
    doc.moveDown(0.65);
  }
}

function drawScoreCard(doc, label, score, summary) {
  const cardLeft = doc.page.margins.left;
  const cardWidth = contentWidth(doc);
  const summaryWidth = cardWidth - CARD_PADDING * 2 - SCORE_COLUMN_WIDTH;
  const scoreColumnLeft = cardLeft + cardWidth - SCORE_COLUMN_WIDTH;

  doc.fontSize(10);
  const summaryHeight = doc.heightOfString(summary, {
    width: summaryWidth,
    align: "left",
    lineGap: 2,
  });

  const cardHeight = Math.max(88, 52 + summaryHeight);

  ensureSpace(doc, cardHeight + 12);

  const cardTop = doc.y;

  doc.roundedRect(cardLeft, cardTop, cardWidth, cardHeight, 6).fillColor(BRAND.light).fill();

  // Label (left column)
  doc
    .fillColor(BRAND.primary)
    .fontSize(12)
    .text(label, cardLeft + CARD_PADDING, cardTop + CARD_PADDING, {
      width: summaryWidth,
      lineBreak: false,
    });

  // Score block (fixed right column — text wraps before this zone)
  const scoreBlockTop = cardTop + CARD_PADDING - 2;

  doc
    .fillColor(BRAND.accent)
    .fontSize(24)
    .text(String(score), scoreColumnLeft, scoreBlockTop, {
      width: SCORE_COLUMN_WIDTH - 8,
      align: "right",
      lineBreak: false,
    });

  doc
    .fillColor(BRAND.muted)
    .fontSize(9)
    .text("/10", scoreColumnLeft, scoreBlockTop + 26, {
      width: SCORE_COLUMN_WIDTH - 8,
      align: "right",
      lineBreak: false,
    });

  doc
    .fillColor(BRAND.muted)
    .fontSize(8)
    .text(scoreLabel(score), scoreColumnLeft, scoreBlockTop + 40, {
      width: SCORE_COLUMN_WIDTH - 8,
      align: "right",
      lineBreak: false,
    });

  // Summary — full width minus score column (padding-right effect)
  const summaryTop = cardTop + CARD_PADDING + 18;

  doc.fillColor(BRAND.muted).fontSize(10).text(summary, cardLeft + CARD_PADDING, summaryTop, {
    width: summaryWidth,
    align: "left",
    lineGap: 2,
  });

  doc.y = cardTop + cardHeight + 6;
  doc.x = doc.page.margins.left;
}

function drawTips(doc, tips) {
  if (!tips?.length) return;

  ensureSpace(doc, 140);

  doc.moveDown(0.5);
  doc.fillColor(BRAND.primary).fontSize(14).text("3 actionable fixes");
  doc.moveDown(0.75);

  tips.slice(0, 3).forEach((tip, index) => {
    drawTipItem(doc, tip, index + 1);
    doc.moveDown(0.65);
  });
}

function drawTipItem(doc, tip, number) {
  const tipObj = typeof tip === "string" ? { problem: tip, solution: "", impact: "" } : tip;
  const textLeft = doc.page.margins.left + BADGE_SIZE + 14;
  const textWidth = contentWidth(doc) - BADGE_SIZE - 14;

  const body =
    `Problem: ${tipObj.problem}\n\n` +
    `Solution: ${tipObj.solution}\n\n` +
    `Impact: ${tipObj.impact}`;

  doc.fontSize(10);
  const blockHeight = doc.heightOfString(body, { width: textWidth, lineGap: 3 });
  const rowHeight = Math.max(BADGE_SIZE + 4, blockHeight);

  ensureSpace(doc, rowHeight + 16);

  const rowTop = doc.y;
  const badgeCenterX = doc.page.margins.left + BADGE_SIZE / 2;
  const badgeCenterY = rowTop + rowHeight / 2;
  const radius = BADGE_SIZE / 2;

  // Orange circle
  doc.circle(badgeCenterX, badgeCenterY, radius).fillColor(BRAND.accent).fill();

  // Centered number inside circle (measure text for true center)
  const num = String(number);
  doc.fontSize(11).fillColor(BRAND.white);
  const numWidth = doc.widthOfString(num);
  const numHeight = doc.heightOfString(num);
  doc.text(num, badgeCenterX - numWidth / 2, badgeCenterY - numHeight / 2 + 0.5, {
    lineBreak: false,
  });

  // Tip copy
  doc.fillColor(BRAND.primary).fontSize(10).text(body, textLeft, rowTop, {
    width: textWidth,
    align: "left",
    lineGap: 3,
  });

  doc.y = rowTop + rowHeight + 4;
  doc.x = doc.page.margins.left;
}

function drawMarkdownSection(doc, markdown) {
  ensureSpace(doc, 80);

  doc.moveDown(0.6);
  doc.fillColor(BRAND.primary).fontSize(14).text("Full report");
  doc.moveDown(0.5);

  const plainText = stripMarkdown(markdown);

  doc.fillColor(BRAND.muted).fontSize(10).text(plainText, {
    width: contentWidth(doc),
    align: "left",
    lineGap: 3,
  });
}

function drawFooter(doc) {
  const footerY = doc.page.height - doc.page.margins.bottom - 24;

  doc
    .fillColor(BRAND.muted)
    .fontSize(8)
    .text(
      "Website Tear Down · Confidential audit for the site owner. Scores are AI-assisted estimates — verify critical changes with a developer.",
      doc.page.margins.left,
      footerY,
      {
        width: contentWidth(doc),
        align: "center",
      }
    );
}

function scoreLabel(score) {
  if (score >= 8) return "Strong";
  if (score >= 5) return "Needs work";
  return "Critical";
}

function stripMarkdown(text) {
  return String(text)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function ensureSpace(doc, minHeight) {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 48;
  if (doc.y + minHeight > bottomLimit) {
    doc.addPage();
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
  }
}
