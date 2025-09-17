# 🏢 InventiBot - The Future of Property Management is Conversational

> **Not just another chatbot. It's an entire property management platform living inside your favorite messaging app.**

[![Platform](https://img.shields.io/badge/Platform-Facebook%20Messenger-0084ff?style=for-the-badge&logo=messenger)](https://www.messenger.com/)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-007ACC?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

## 🚀 **Revolutionizing Property Management Through Conversation**

Welcome to **InventiBot** - where we've taken the entire property management experience and compressed it into a conversational interface. No app downloads. No complex UIs. No learning curve. Just natural conversation with powerful results.

### 🎯 **The Problem We Solved**

Traditional property management requires:
- ❌ Multiple apps for different functions
- ❌ Complex forms and interfaces
- ❌ Training for residents and staff
- ❌ Constant app updates and maintenance
- ❌ Storage space on users' devices

### 💡 **Our Revolutionary Solution**

**One chat interface. Infinite possibilities.**

We've built what others said was impossible - a complete property management system that runs entirely through chat. Every feature, every function, every interaction - all through the messaging app that's already on your phone.

---

## 🌟 **Game-Changing Features**

### 🏠 **Smart Home IoT Integration**
*Control your entire home through chat*
- 💡 **Lights**: "Turn off bedroom lights"
- 🌡️ **Climate**: "Set temperature to 72°F"
- 🔒 **Locks**: "Lock the front door"
- 📊 **Sensors**: Real-time monitoring and alerts
- 🔋 **Energy**: Track and optimize usage

**Powered by Home Assistant integration** - connects with 1000+ smart device brands

### 🎫 **Digital Visitor Pass System**
*Secure, trackable, instant*
- 📱 Generate unique QR codes for guests
- ⏰ Time-limited access control
- 👥 Visitor type categorization (Guest, Delivery, Contractor, Service)
- 📊 Real-time visitor tracking dashboard
- 🔔 Instant notifications to security

### 🔧 **Intelligent Maintenance Management**
*Report issues in seconds, not minutes*
- 🎯 Smart categorization and priority routing
- 🔄 Real-time status updates
- ⏱️ SLA tracking and reporting

### 📢 **Announcement Broadcasting**
*Reach everyone instantly*
- 🎯 Targeted messaging by unit, floor, or building
- 📍 Priority levels (Urgent, High, Normal, Low)
- ⏰ Scheduled announcements
- 📊 Read receipts and engagement tracking

### 📅 **Amenity Booking System**
*Book facilities with a simple message*
- 🏊 Pool, Gym, Party rooms, BBQ areas
- 📆 Smart conflict detection
- 🔄 Automatic reminders

### 👤 **Resident Authentication**
*Secure without being complicated*
- 🔐 One-time invite codes
- 🆔 Unit-based verification
- 🔒 Role-based access control
- 📱 No passwords to remember
- 🛡️ Enterprise-grade security

---

## 🎮 **The Magic of Conversational UI**

### **Quick Reply Buttons**
No typing needed! Interactive buttons guide users through complex flows:
```
🏠 Main Menu
├── 🔧 Report Issue
├── 📅 Book Amenity
├── 🎫 Create Visitor Pass
├── 🏠 Control Smart Home
├── 📢 View Announcements
└── ❓ Get Help
```

---

## 🏆 **Why This is Revolutionary**

### 📱 **Zero Friction Adoption**
- **No app to download** - Use existing Messenger
- **No learning curve** - Everyone knows how to chat
- **No storage needed** - Runs in the cloud
- **No updates required** - Always latest version

### ⚡ **Lightning Fast Implementation**
- Deploy to hundreds of units in minutes
- Instant onboarding with invite codes
- No training required for residents
- Works on any device with Messenger

### 💰 **Massive Cost Savings**
- No mobile app development costs
- No app store fees
- No cross-platform maintenance
- Reduced support tickets through automation

### 🌍 **Universal Accessibility**
- Works on any smartphone
- No OS restrictions (iOS/Android)

---

#### 🤖 **InventiBot Core** (This Repository)
The conversational engine that powers all resident interactions through Messenger.

#### 🎛️ **[Admin Dashboard](https://github.com/Miguel2604/inventi-admin)**
A powerful web-based control center for property managers featuring:
- 👥 **Resident Management** - Invite codes, unit assignments, access control
- 🔧 **Maintenance Tracking** - Visual workflow for all repair requests
- 📢 **Announcement Center** - Broadcast and schedule messages
- 🎫 **Visitor Management** - Track and approve visitor passes


### **Architecture**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Messenger     │────▶│   InventiBot    │────▶│    Supabase     │
│   Interface     │◀────│   Core Engine   │◀────│    Database     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │              ┌─────────────────┐              │
         └──────────────│  Home Assistant │──────────────┘
                        │   IoT Gateway   │
                        └─────────────────┘
```

### **Tech Stack**
- **Runtime**: Node.js with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Messaging**: Facebook Messenger Platform API
- **IoT**: Home Assistant Integration
- **Security**: Webhook verification, JWT tokens
- **Testing**: Jest with 87% coverage

---

For detailed setup instructions, see [HOWTO.md](./HOWTO.md)

---

## 📖 **Documentation**

- 📚 [Complete Documentation](./docs/README.md)
- 🚀 [Setup Guide](./docs/setup/)
- 🎯 [Feature Guides](./docs/features/)
- 🔧 [Troubleshooting](./docs/troubleshooting/)

---

---

## 👥 **The Team**

Built with ❤️ by Neosolve who believe property management should be as easy as sending a message.

---

## 📜 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---