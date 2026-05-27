import PDFDocument from "pdfkit";

const BRAND = {
  primary: "#1a222d",
  accent: "#e85d2a",
  muted: "#4a5568",
  light: "#f4f1eb",
};

const CATEGORIES = [
  { key: "seo", label: "SEO" },
  { key: "leadCapture", label: "Lead Capture" },
  { key: "mobileFriendliness", label: "Mobile-Friendliness" },
];

/**
 * Build a professional audit PDF and return it as a Buffer (for email attachments).
 *
 * @param {object} reportData - Output from runSiteAudit (seo, leadCapture, mobileFriendliness, tips; optional markdown)
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

  doc
    .fillColor(BRAND.muted)
    .fontSize(11)
    .text("Audited website", { continued: false });

  doc
    .fillColor(BRAND.primary)
    .fontSize(12)
    .text(websiteUrl, { link: websiteUrl, underline: true });

  doc.moveDown(0.3);

  doc
    .fillColor(BRAND.muted)
    .fontSize(10)
    .text(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`);

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

    ensureSpace(doc, 90);
    drawScoreCard(doc, label, section.score, section.summary);
    doc.moveDown(0.6);
  }
}

function drawScoreCard(doc, label, score, summary) {
  const cardTop = doc.y;
  const cardLeft = doc.page.margins.left;
  const cardWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .roundedRect(cardLeft, cardTop, cardWidth, 72, 6)
    .fillColor(BRAND.light)
    .fill();

  doc.y = cardTop + 14;
  doc.x = cardLeft + 16;

  doc.fillColor(BRAND.primary).fontSize(12).text(label, { width: cardWidth - 100 });

  const scoreX = cardLeft + cardWidth - 56;
  doc
    .fillColor(BRAND.accent)
    .fontSize(22)
    .text(String(score), scoreX, cardTop + 10, { width: 40, align: "right" });

  doc
    .fillColor(BRAND.muted)
    .fontSize(9)
    .text("/10", scoreX, cardTop + 36, { width: 40, align: "right" });

  doc
    .fillColor(BRAND.muted)
    .fontSize(10)
    .text(scoreLabel(score), scoreX - 30, cardTop + 48, { width: 70, align: "right" });

  doc.x = cardLeft + 16;
  doc.y = cardTop + 34;

  doc.fillColor(BRAND.muted).fontSize(10).text(summary, {
    width: cardWidth - 32,
    align: "left",
  });

  doc.y = cardTop + 72 + 4;
  doc.x = doc.page.margins.left;
}

function drawTips(doc, tips) {
  if (!tips?.length) return;

  ensureSpace(doc, 120);

  doc.moveDown(0.4);
  doc.fillColor(BRAND.primary).fontSize(14).text("3 actionable fixes");
  doc.moveDown(0.6);

  tips.slice(0, 3).forEach((tip, index) => {
    ensureSpace(doc, 48);
    const tipY = doc.y;

    doc
      .circle(doc.page.margins.left + 10, tipY + 8, 10)
      .fillColor(BRAND.accent)
      .fill();

    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .text(String(index + 1), doc.page.margins.left + 5, tipY + 3, {
        width: 12,
        align: "center",
      });

    doc
      .fillColor(BRAND.primary)
      .fontSize(11)
      .text(tip, doc.page.margins.left + 28, tipY, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 28,
        align: "left",
      });

    doc.moveDown(0.5);
  });
}

function drawMarkdownSection(doc, markdown) {
  ensureSpace(doc, 80);

  doc.moveDown(0.6);
  doc.fillColor(BRAND.primary).fontSize(14).text("Full report");
  doc.moveDown(0.5);

  const plainText = stripMarkdown(markdown);

  doc.fillColor(BRAND.muted).fontSize(10).text(plainText, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
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
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
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
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;
  if (doc.y + minHeight > bottomLimit) {
    doc.addPage();
    doc.x = doc.page.margins.left;
  }
}
