#  ![Logo](/icons/icon-32.png) Email Feed for Thunderbird

Email Feed is a Thunderbird extension that transforms any email folder into a clean, readable feed, similar to a social media timeline. It's designed to help you quickly browse newsletters, updates, and other non-urgent emails without the clutter of a traditional email client.

## Why Use Email Feed?

It allows you to create a workflow that moves newsletters and similar emails to a folder with filters and as read. This way, your inbox won't see them, and you won't receive notifications for non-urgent emails. When you have time, you can read them all at once in a nice feed-like view.

## Features

- **Feed View:** Display emails from any folder in a simple, chronological feed.
- **Privacy First:** Automatically blocks tracking pixels, spy images, and tracking links in your emails.
- **Easy Navigation:** Right-click any folder to open it as a feed in a new tab.
- **Clean Interface:** A minimalist design that lets you focus on the content of your emails.
- **Theme Aware:** Automatically adapts to Thunderbird's light and dark themes.

## How to Use

1.  **Install the extension** in Thunderbird.
2.  In the folder pane, **right-click on any email folder** you want to view as a feed.
3.  Select **"Open as Feed"** from the context menu.
4.  A new tab will open with the emails from that folder displayed as a feed.

## Privacy

Email marketing has become increasingly invasive, with most commercial emails containing trackers that report your activity back to the sender. Email Feed helps protect your privacy by blocking these trackers.

The tracker blocking is based on a comprehensive list of known tracking domains and patterns. It removes:
- Invisible tracking pixels (1x1 images)
- Images and links that redirect through tracking services
- Tracking scripts and other spy elements

This feature is enabled by default and requires no configuration.

## Installation

You can install Email Feed from the [Thunderbird Add-ons store](https://addons.thunderbird.net/en-US/thunderbird/addon/email-feed/).

Alternatively, you can build it from the source:
1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Run `npm run build` to create a distributable `.zip` file.
4. In Thunderbird, go to `Tools > Add-ons and Themes`, click the gear icon, and select "Install Add-on From File...".
5. Select the generated `.xpi` file.
