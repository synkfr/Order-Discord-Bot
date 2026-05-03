# Discord Order Bot

A professional, enterprise-grade creative services order ticket system for Discord. Automate your workflow with forum-based orders, private tickets, freelancer claiming, and customer reviews.

## Features

- **Forum-Based Orders**: Clean, organized public order posts using Discord Forum channels.
- **Private Ticket System**: Automated ticket creation in dedicated categories for privacy.
- **Claim System**: Professional "Take Order" workflow with freelancer limits and status synchronization.
- **Database Persistence**: Powered by SQLite for reliable tracking across restarts.
- **Review System**: Built-in 1-5 star rating and feedback system for customers.
- **Portfolio Showcase**: Dedicated command for editors to showcase their work.
- **Advanced Logging**: Every action is logged to a private staff channel.
- **Asset Support**: Staff can upload reference files when creating orders.

## Commands

- `/order`: Create a new order (Staff only).
- `/review`: Submit feedback for a service (Customers).
- `/portfolio`: Showcase your portfolio.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure your `.env` file (see `.env.example`).
3. Register commands:
   ```bash
   node register.js
   ```
4. Start the bot:
   ```bash
   node index.js
   ```

## Requirements

- Node.js v16.11.0 or higher.
- A Discord Bot token with `Guilds`, `GuildMessages`, and `MessageContent` intents.
