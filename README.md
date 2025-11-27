# True Hire🎓
True Hire is a transformative job hiring platform designed to empower non-
degree candidates and bridge the skill gap in modern recruitment💼.

---

## 📝 Overview
#### The Problem:-
Many capable individuals are overlooked because traditional hiring prioritizes certificates
over actual skills. Most existing platforms prioritize academic qualifications over actual skills.

#### The Solution (True Hire):- 
A job hiring platform that connects skilled individuals, regardless of formal
education, with employers seeking practical talent.

#### Core Method:-
Candidates are evaluated based on real-world skills using AI-generated tests, resume
parsing, and personalized course recommendations.

#### ✨Goal:-
To build a platform where talent speaks louder than titles.


---

## ⭐ Features
| Feature | Description |
|--------|-------------|
| Modular UI | Components structured for reuse |
| Secure API Layer | Centralized request handling |
| State Management | Predictable, scalable state flow |
| Dashboard Ready | Charts, tables, filtering |
| Fast Build | Optimized Vite/Webpack configuration |

---

## 🧰 Tech Stack
| Category | Tools |
|---------|-------|
| Framework | React / Next |
| Styling | Tailwind / CSS Modules |
| State | Redux / Zustand |
| Build | Vite / Webpack |
| API | REST / GraphQL |

---

## 🏗️ System Architecture

### High-Level
User → UI Layer → API Layer → Backend → Database


## 📁 Folder Structure
```bash
src/
├── components/
├── pages/
├── hooks/
├── services/
├── utils/
├── styles/
└── assets/
```

---

## 🔧 Installation
```bash
git clone https://github.com/your-user/your-repo.git
cd your-repo
npm install
```
---

## ▶️ Usage
### Development
```bash
npm run dev
```

### Build & Preview
```bash
npm run build
npm run preview
```

---

## ⚙️ Environment Variables

### Environment Variables

| Variable       | Description         | Example                     |
|----------------|---------------------|-----------------------------|
| VITE_API_URL   | Backend API URL     | https://api.example.com     |
| VITE_ENV       | Environment mode    | development                 |

---

## 📦 Deployment
```bash
Vercel
Bashnpm run build
vercel deploy --prod
Netlify
Bashnpm run build
netlify deploy --prod
```
---

## API Calls Distribution

| Category | Requests | Percentage |
|----------|:--------:|-----------:|
| Auth     Auth | #########          | **25%** |
|     Jobs | #################  | **45%** |
|    Users | #######            | **18%** |
|     Misc | ###                | **12%** |
