<div align="center">
  <h1>NOCIQ</h1>
  <p>Network Operations Center Intelligence & Quality Platform</p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
  [![OnlyDust](https://img.shields.io/badge/OnlyDust-Project-orange)](https://app.onlydust.com)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.95.0+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
</div>

## 📋 Overview

NOCIQ is an intelligent incident tracking and analytics platform designed for telecom network operations. It automates outage report generation, enhances Root Cause Analysis (RCA) tracking, and provides real-time insights into network performance.

Originally developed as an internal tool, NOCIQ is now open-source to enable collaboration across the telecom industry and beyond. Our mission is to improve network reliability through better outage management and analytics.

### 🌟 Why NOCIQ?

- **Real-time monitoring** of network outages with intuitive visualizations
- **Automated reporting** to streamline incident documentation
- **Advanced analytics** for identifying patterns and improving MTTR
- **Collaborative RCA** to prevent recurring issues
- **Open architecture** that can be extended and customized

## 🚀 Features

### Dashboard & Monitoring

- Real-time outage tracking dashboard
- Status indicators and severity classification
- Geographic distribution of outages
- Performance metrics and KPIs

### Outage Management

- Comprehensive outage listing with advanced filtering
- Detailed outage report creation
- Bulk import/export capabilities
- WhatsApp-ready text reports for stakeholder communication

### Root Cause Analysis

- Structured RCA documentation
- Categorization of outage causes
- Historical tracking of resolved issues
- Trend analysis for recurring problems

### Analytics & Visualization

- MTTR calculation and tracking
- Site-level outage insights
- Interactive charts and heatmaps
- Periodic trend analysis

### API & Integration

- RESTful API for automation and integration
- Webhook support for real-time notifications
- Extensible adapter system for third-party services

## 🛠️ Technology Stack

### Frontend

- **React** - Modern UI framework
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible component system
- **React Query** - Data fetching and state management
- **Chart.js/Recharts** - Data visualization

### Backend

- **FastAPI** - High-performance Python API framework
- **Pandas/NumPy** - Data processing and analysis
- **Firebase Admin SDK** - Database interaction

### Database & Authentication

- **Google Firestore** - NoSQL database
- **Firebase Authentication** - User management

### Visualization & Mapping

- **Matplotlib & Seaborn** - Data visualization
- **Plotly** - Interactive dashboards
- **Folium** - Geospatial mapping

### Deployment

- **Vercel** - Frontend hosting
- **Firebase Cloud Functions / AWS Lambda** - Backend services

## 📦 Installation

### Prerequisites

- Node.js 18.x or higher
- Python 3.9 or higher
- Firebase project (for Firestore)

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/nociq.git
cd nociq

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```
