export type EmailTemplate = {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Thrumble-style transactional layout: system font, white, no footer. */
export function wrapEmailHtml(title: string, innerHtml: string): string {
  const safeTitle = escapeHtml(title)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeTitle}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: #000000;
      background-color: #ffffff;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    .email-wrapper {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    p {
      margin: 0 0 16px 0;
      color: #000000;
      word-break: normal;
      overflow-wrap: normal;
    }
    a {
      color: #1a73e8;
      text-decoration: underline;
    }
    @media only screen and (min-width: 600px) {
      body {
        font-size: 17px !important;
      }
      p {
        font-size: 17px !important;
      }
    }
  </style>
</head>
<body bgcolor="#ffffff">
  <div class="email-wrapper">
${innerHtml}
  </div>
</body>
</html>
`
}
