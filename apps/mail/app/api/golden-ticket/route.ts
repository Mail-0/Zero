import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/app/api/utils';
import { earlyAccess, user } from '@zero/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@zero/db';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [foundUser] = await db
      .select({
        hasUsedTicket: earlyAccess.hasUsedTicket,
        email: user.email,
        isEarlyAccess: earlyAccess.isEarlyAccess,
      })
      .from(user)
      .leftJoin(earlyAccess, eq(user.email, earlyAccess.email))
      .where(eq(user.id, userId))
      .limit(1);

    if (!foundUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (foundUser.hasUsedTicket) {
      return NextResponse.json({ error: 'Golden ticket already claimed' }, { status: 400 });
    }

    if (!foundUser.isEarlyAccess && process.env.EARLY_ACCESS_ENABLED) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : { emails: { send: async (...args: any[]) => console.log(args) } };

    await resend.emails.send({
      from: '0.email <onboarding@0.email>',
      to: email,
      subject: 'You <> Zero',
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://i.imgur.com/xBnWSpN.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(246,249,252);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";padding-top:60px;padding-bottom:60px'>
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
      You&#x27;ve been granted early access to Zero!
      <div>
        ‌​‍‎‏﻿
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="background-color:rgb(255,255,255);border-radius:8px;margin-left:auto;margin-right:auto;padding:32px;max-width:600px">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <img
                      alt="Zero Early Access"
                      src="https://i.imgur.com/xBnWSpN.png"
                      style="width:100%;height:auto;object-fit:cover;border-radius:4px;display:block;outline:none;border:none;text-decoration:none" />
                  </td>
                </tr>
              </tbody>
            </table>
            <h1
              style="font-size:24px;font-weight:700;color:rgb(51,51,51);margin-top:0px;margin-bottom:24px">
              Welcome to Zero Early Access!
            </h1>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:16px;margin-top:16px">
              Hi there,
            </p>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:32px;margin-top:16px">
              Your friend has invited you to join Zero! We're excited to have you on board. Click the button below to get started.
            </p>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="text-align:center;margin-bottom:32px">
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://0.email/login"
                      style="background-color:rgb(0,0,0);color:rgb(255,255,255);font-weight:700;padding:16px 32px;border-radius:4px;text-decoration-line:none;text-align:center;box-sizing:border-box;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px"
                      target="_blank"
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%;mso-text-raise:18" hidden>&#8202;&#8202;&#8202;</i><![endif]--></span
                      ><span
                        style="max-width:100%;display:inline-block;line-height:120%;mso-padding-alt:0px;mso-text-raise:9px"
                        >Access Zero Now</span
                      ><span
                        ><!--[if mso]><i style="mso-font-width:400%" hidden>&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                      ></a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:24px;margin-top:16px">
              Join our
              <a
                href="https://discord.gg/0email"
                style="color:rgb(0,0,0);text-decoration-line:underline"
                target="_blank"
                >Discord community</a
              >
              to connect with other early users and the Zero team for support,
              feedback, and exclusive updates.
            </p>
            <p
              style="font-size:16px;line-height:24px;color:rgb(85,85,85);margin-bottom:24px;margin-top:16px">
              Your feedback during this early access phase is invaluable to us
              as we continue to refine and improve Zero. We can't wait to
              hear what you think!
            </p>
            <hr
              style="border-color:rgb(230,235,241);margin-top:32px;margin-bottom:32px;width:100%;border:none;border-top:1px solid #eaeaea" />
            <p
              style="font-size:12px;line-height:16px;color:rgb(136,152,170);margin:0px;margin-bottom:16px;margin-top:16px">
              ©
              <!-- -->2025<!-- -->
              Zero Email Inc. All rights reserved.
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`,
    });

    await db
      .insert(earlyAccess)
      .values({
        id: crypto.randomUUID(),
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
        isEarlyAccess: true,
        hasUsedTicket: '',
      })
      .catch(async (error) => {
        console.log('Error registering early access', error);
        if (error.code === '23505') {
          console.log('Email already registered for early access, granted access');
          await db
            .update(earlyAccess)
            .set({
              hasUsedTicket: '',
              updatedAt: new Date(),
              isEarlyAccess: true,
            })
            .where(eq(earlyAccess.email, email));
        } else {
          console.error('Error registering early access', error);
          await db
            .update(earlyAccess)
            .set({
              hasUsedTicket: email,
              updatedAt: new Date(),
            })
            .where(eq(earlyAccess.email, foundUser.email))
            .catch((err) => {
              console.error('Error updating early access', err);
            });
          throw error;
        }
      });

    await db
      .update(earlyAccess)
      .set({
        hasUsedTicket: email,
        updatedAt: new Date(),
      })
      .where(eq(earlyAccess.email, foundUser.email));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to handle golden ticket:', error);
    return NextResponse.json({ error: 'Failed to handle golden ticket' }, { status: 500 });
  }
}
