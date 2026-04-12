# Budget App Project Document

## Working title
A self-hosted, privacy-first, multi-currency envelope budgeting app for local networks and private VPN access.

---

## 1. Vision

Build a lightweight budgeting app inspired by the YNAB envelope-budgeting philosophy, but designed from the start to be:

- local-first and privacy-first
- self-hosted on user-owned infrastructure
- accessible across devices on a home network or through a private VPN such as Tailscale
- collaborative across multiple users on a shared budget
- capable of handling multiple currencies correctly in one unified system

The app should feel like a cloud service in day-to-day use, but without relying on third-party cloud storage or public internet exposure.

---

## 2. Product philosophy

### Core principles

1. **Privacy first**  
   Financial data stays under the user's control. The canonical database runs on infrastructure the user owns and trusts.

2. **Local-first deployment**  
   The system is designed to run on a home server or other private machine. Clients access it over LAN or through Tailscale.

3. **Budgeting over passive tracking**  
   This is not just an expense tracker. It is an intentional budgeting tool based on envelope budgeting.

4. **Correctness over convenience**  
   Core accounting and budgeting behavior should be conceptually sound, even if some convenience features are postponed.

5. **Lightweight and focused**  
   The product should stay simple. Avoid feature bloat, especially in v1.

6. **Multi-currency as a first-class concept**  
   Multiple currencies should be handled natively rather than forced into a single-currency workaround.

7. **Modular extensibility**  
   Reports, savings goals, and other advanced features should be layered cleanly on top of a stable core model.

---

## 3. Problem statement

Most budgeting tools today have one or more of the following drawbacks:

- they are cloud-first and require users to trust third-party servers with sensitive financial data
- they rely heavily on bank integrations and aggregation services
- they are feature-heavy and cumbersome for users who want a clean budgeting workflow
- they do not support multi-currency budgeting well, especially when a user wants to manage accounts in different currencies in a single system
- they are not well suited to self-hosted or privacy-conscious workflows

This project aims to fill that gap with a focused, self-hosted budgeting system.

---

## 4. Target use case

The primary intended use case is:

- the app runs on a home server or other private machine
- the database is accessible in real time to devices on the local network or connected through Tailscale
- users access the app from a desktop browser or mobile browser
- multiple users collaborate on one shared household budget
- budgeting follows a YNAB-like envelope system
- accounts may exist in multiple currencies

---

## 5. v1 scope

Version 1 should focus on a solid core architecture and correct budgeting behavior.

### Included in v1

- manual account management
- manual transaction entry
- CSV transaction import
- shared multi-user access to a single budget
- envelope/category budgeting
- money assignment to budget categories
- transfers between accounts
- multi-currency support at a basic but correct level
- cross-client syncing through a central local server
- simple summary reports and data visualization
- manual reconciliation workflow
- automated database backups
- CSV/JSON export
- responsive browser-based client for desktop and mobile use

### Explicitly out of scope for v1

- direct bank syncing
- public internet exposure
- peer-to-peer sync without a central server
- investment portfolio tracking
- tax/accounting workflows
- advanced forecasting
- OCR receipt scanning
- AI categorization
- complex role/permission systems
- native desktop or mobile apps


## 18. Non-goals

This app is **not** trying to be:

- a cloud SaaS product in v1
- a public internet finance portal
- a Plaid-style bank aggregation service
- a tax preparation tool
- a full accounting system for businesses
- an investment portfolio platform
- a peer-to-peer offline sync system
- a feature-maximal personal finance suite

The goal is a clean, correct, privacy-first budgeting tool.

---

## 27. Summary

This project is a privacy-first, self-hosted budgeting system centered on a shared household budget, YNAB-style envelope budgeting, and first-class multi-currency support.

The core implementation strategy is:

- central private server
- responsive browser client
- collaborative shared budget
- budgeting separated by currency
- clean support for imports, reconciliation, transfers, and reporting

The emphasis in v1 is not maximum features. It is a correct, elegant, trustworthy core.

