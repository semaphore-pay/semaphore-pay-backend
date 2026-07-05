export const magicLinkEmail = (userName: string, magicLink: string) => {
  const title = 'Sign in to Semaphore Pay';
  const introMessage = `Hi ${userName},<br><br>Click the button below to securely sign in to your Semaphore Pay account. This link will expire in 10 minutes.`;
  const footerWarning =
    "If you didn't request this email, you can safely ignore it.";

  const styles = {
    body:
      "font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0; margin: 0; width: 100%;",
    container:
      'max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #eeeeee; overflow: hidden;',
    content: 'padding: 40px; color: #333333; line-height: 1.6;',
    logoContainer: 'text-align: center; margin-bottom: 24px;',
    header:
      'font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #121212; letter-spacing: -0.5px; text-align: center;',
    buttonContainer: 'text-align: center; margin: 30px 0;',
    button:
      'background-color: #121212; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;',
    footer:
      'padding: 20px; font-size: 12px; color: #9CA3AF; text-align: center;',
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="${styles.body}">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <div style="${styles.container}">
                <div style="${styles.content}">
                  
                  <div style="${styles.logoContainer}">
                    <img src="https://semaphorepay.tech/logo.png" alt="Semaphore Pay Logo" style="height: 48px; width: auto;" />
                  </div>

                  <h1 style="${styles.header}">${title}</h1>
                  <p>${introMessage}</p>
                  
                  <div style="${styles.buttonContainer}">
                    <a href="${magicLink}" style="${
    styles.button
  }">Verify and Sign In</a>
                  </div>

                  <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
                    Or copy and paste this URL into your browser:<br>
                    <a href="${magicLink}" style="color: #2563eb; word-break: break-all;">${magicLink}</a>
                  </p>

                  <p style="font-size: 13px; color: #6B7280; margin-top: 30px;">${footerWarning}</p>
                </div>
                <div style="${styles.footer}">
                  &copy; ${new Date().getFullYear()} Semaphore Pay. All rights reserved.<br>
                  <a href="https://semaphorepay.tech" style="color: #9CA3AF; text-decoration: none;">semaphorepay.tech</a>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};
