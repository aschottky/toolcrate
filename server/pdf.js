import PDFDocument from "pdfkit";
import { AUDIT_CATEGORIES } from "./categories.js";

const BRAND = {
  primary: "#1a222d",
  accent: "#e85d2a",
  accentSoft: "#fdeee6",
  muted: "#4a5568",
  light: "#f4f1eb",
  white: "#ffffff",
};

const SCORE_COLUMN_WIDTH = 88;
const CARD_PADDING = 16;
const BADGE_SIZE = 24;
const TIP_AFTER_IMPACT_GAP = 12;
const SIGN_OFF_TEXT = `A quick note from the creator: I'm Alexander. I've been building the web for decades, and I built this tool to cut through the SEO agency BS and show business owners exactly what's broken. You can hand this report to your current web guy to fix. But if you want it done right, right now, text me directly at 818-216-2428 or reply to the email that sent you this report. Let's get these leaks plugged. — Alexander Schottky, WebDev`;

/**
 * Build a professional audit PDF and return it as a Buffer (for email attachments).
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

      drawSignOff(doc);
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
  doc.fillColor(BRAND.accent).fontSize(10).text("WEBSITE TEAR DOWN", { align: "left" });
  doc.moveDown(0.4);
  doc.fillColor(BRAND.primary).fontSize(26).text("Website Tear Down Audit", { align: "left" });
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

  for (const { key, label } of AUDIT_CATEGORIES) {
    const section = reportData[key];
    if (!section) continue;
    drawScoreCard(doc, label, section.score, section.summary);
    doc.moveDown(0.55);
  }
}

function drawScorePill(doc, rightX, topY, score) {
  const label = `${score}/10`;
  doc.fontSize(11);
  const textWidth = doc.widthOfString(label);
  const pillWidth = textWidth + 20;
  const pillHeight = 26;
  const pillX = rightX - pillWidth;

  doc
    .roundedRect(pillX, topY, pillWidth, pillHeight, pillHeight / 2)
    .fillColor(BRAND.accentSoft)
    .fill();

  const textHeight = doc.heightOfString(label, { width: pillWidth });
  doc.fillColor(BRAND.accent).fontSize(11).text(label, pillX, topY + (pillHeight - textHeight) / 2, {
    width: pillWidth,
    align: "center",
    lineBreak: false,
  });

  return pillWidth;
}

function drawScoreCard(doc, label, score, summary) {
  const cardLeft = doc.page.margins.left;
  const cardWidth = contentWidth(doc);
  const summaryWidth = cardWidth - CARD_PADDING * 2 - SCORE_COLUMN_WIDTH;
  const scoreColumnRight = cardLeft + cardWidth - CARD_PADDING;

  doc.fontSize(10);
  const summaryHeight = doc.heightOfString(summary, {
    width: summaryWidth,
    align: "left",
    lineGap: 2,
  });

  const cardHeight = Math.max(92, 56 + summaryHeight);

  ensureSpace(doc, cardHeight + 12);

  const cardTop = doc.y;

  doc.roundedRect(cardLeft, cardTop, cardWidth, cardHeight, 6).fillColor(BRAND.light).fill();

  const labelTop = cardTop + CARD_PADDING;
  drawScorePill(doc, scoreColumnRight, labelTop, score);

  doc
    .fillColor(BRAND.primary)
    .fontSize(12)
    .text(label, cardLeft + CARD_PADDING, labelTop, {
      width: summaryWidth,
      lineBreak: false,
    });

  doc
    .fillColor(BRAND.muted)
    .fontSize(8)
    .text(scoreLabel(score), scoreColumnRight - SCORE_COLUMN_WIDTH + 8, labelTop + 30, {
      width: SCORE_COLUMN_WIDTH - 16,
      align: "right",
      lineBreak: false,
    });

  const summaryTop = cardTop + CARD_PADDING + 22;

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

  ensureSpace(doc, 120);

  doc.moveDown(0.4);
  doc.fillColor(BRAND.primary).fontSize(14).text("3 actionable fixes");
  doc.moveDown(0.75);

  tips.slice(0, 3).forEach((tip, index) => {
    drawTipItem(doc, tip, index + 1);
  });
}

function drawTipItem(doc, tip, number) {
  const tipObj = typeof tip === "string" ? { problem: tip, solution: "", impact: "" } : tip;
  const textLeft = doc.page.margins.left + BADGE_SIZE + 14;
  const textWidth = contentWidth(doc) - BADGE_SIZE - 14;

  const lines = [
    { prefix: "Problem: ", text: tipObj.problem },
    { prefix: "Solution: ", text: tipObj.solution },
    { prefix: "Impact: ", text: tipObj.impact },
  ];

  doc.fontSize(10);
  let blockHeight = 0;
  for (const line of lines) {
    blockHeight += doc.heightOfString(line.prefix + line.text, { width: textWidth, lineGap: 2 });
    blockHeight += 4;
  }
  blockHeight += TIP_AFTER_IMPACT_GAP;

  const rowHeight = Math.max(BADGE_SIZE + 4, blockHeight);

  ensureSpace(doc, rowHeight + 20);

  const rowTop = doc.y;
  const badgeCenterX = doc.page.margins.left + BADGE_SIZE / 2;
  const badgeCenterY = rowTop + BADGE_SIZE / 2;
  const radius = BADGE_SIZE / 2;

  doc.circle(badgeCenterX, badgeCenterY, radius).fillColor(BRAND.accent).fill();

  const num = String(number);
  doc.fontSize(11).fillColor(BRAND.white);
  const numWidth = doc.widthOfString(num);
  const numHeight = doc.heightOfString(num);
  doc.text(num, badgeCenterX - numWidth / 2, badgeCenterY - numHeight / 2 + 0.5, {
    lineBreak: false,
  });

  let textY = rowTop;

  for (const line of lines) {
    doc.fillColor(BRAND.primary).fontSize(10);
    doc.text(line.prefix, textLeft, textY, { continued: true, lineBreak: false });
    doc.fillColor(BRAND.muted).text(line.text, { width: textWidth, lineGap: 2 });
    textY = doc.y + 4;

    if (line.prefix.startsWith("Impact")) {
      textY += TIP_AFTER_IMPACT_GAP;
    }
  }

  doc.y = Math.max(textY, rowTop + rowHeight);
  doc.x = doc.page.margins.left;
  doc.moveDown(0.35);
}

function drawMarkdownSection(doc, markdown) {
  ensureSpace(doc, 80);
  doc.moveDown(0.6);
  doc.fillColor(BRAND.primary).fontSize(14).text("Full report");
  doc.moveDown(0.5);
  doc.fillColor(BRAND.muted).fontSize(10).text(stripMarkdown(markdown), {
    width: contentWidth(doc),
    align: "left",
    lineGap: 3,
  });
}

function drawSignOff(doc) {
  doc.addPage();
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;

  doc.fillColor(BRAND.primary).fontSize(13).text("A note from Alexander");
  doc.moveDown(0.8);

  doc.fillColor(BRAND.muted).fontSize(10).text(SIGN_OFF_TEXT, {
    width: contentWidth(doc),
    align: "left",
    lineGap: 4,
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
