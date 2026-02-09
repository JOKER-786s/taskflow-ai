# 🚀 TaskFlow AI

**TaskFlow AI** is a next-generation, aesthetic project management dashboard that blends traditional Kanban methodologies with the power of Generative AI. Built with React 19, Tailwind CSS, and the Google Gemini API, it offers automated time tracking, context-aware AI assistance, and real-time productivity analytics wrapped in a modern "Glassmorphism" UI.

![TaskFlow AI Banner](https://via.placeholder.com/1200x600/6366f1/ffffff?text=TaskFlow+AI+Dashboard)
*(Replace this image with a screenshot of your main Kanban board)*

---

## ✨ Key Features

### 📋 Intelligent Task Management
*   **Kanban Board:** Drag-and-drop interface with statuses: *Backlog, In Progress, Review, Completed*.
*   **Bulk Actions:** Select multiple tickets via checkboxes to mass-update **Status**, **Priority**, **Due Dates**, or **Delete** them in batch using the floating action bar.
*   **Smart Search:** Real-time filtering by title, description, or tags.
*   **Confetti Celebration:** Visual rewards when tasks are completed.

### ⏱️ Automated Time Tracking
*   **Smart Timers:** Moving a card to **"In Progress"** automatically starts a timer. Moving it to **"Completed"** stops it.
*   **Precision Logging:** Tracks time down to the minute.
*   **Manual Override:** Play/Pause buttons on every card with live updates.

### 🤖 Gemini AI Integration
*   **Context-Aware Chat:** The AI knows your task list. Ask *"What is my highest priority?"* or *"Summarize my backlog."*
*   **3 Specialized Modes:**
    *   ⚡ **Blitz Mode:** Fast, concise answers (Gemini 2.5 Flash).
    *   🌍 **Explorer Mode:** Real-world location finding with Google Maps grounding.
    *   🎨 **Artist Mode:** Generate images directly in the chat (Imagen 3).
*   **Magic Slides:** Transform raw Markdown notes into structured presentation slides instantly using GenAI.

### 📊 Analytics & Organization
*   **Productivity Pulse:** An interactive line chart visualizing work hours logged over the last 7 days.
*   **Calendar View:** A monthly overview of task deadlines.
*   **Markdown Notes:** A built-in editor for taking notes, which can be converted into tasks.

### 🎨 Modern UI/UX
*   **Glassmorphism Design:** Translucent panels, blurred backgrounds, and animated gradients.
*   **Dark/Light Mode:** Fully supported themes.
*   **Font Switcher:** Toggle between Animated (Fredoka), Sans, Hand-drawn, or Serif fonts.

---

## 📸 Screenshots

| Kanban Board | AI Assistant |
|:---:|:---:|
| ![Kanban](https://via.placeholder.com/600x400/e0e7ff/4f46e5?text=Kanban+Board) | ![AI Chat](https://via.placeholder.com/600x400/e0e7ff/4f46e5?text=Gemini+Chat) |
| *Manage tasks with drag-and-drop* | *Ask Gemini about your project* |

| Analytics View | Magic Slides |
|:---:|:---:|
| ![Analytics](https://via.placeholder.com/600x400/e0e7ff/4f46e5?text=Analytics) | ![Slides](https://via.placeholder.com/600x400/e0e7ff/4f46e5?text=Magic+Slides) |
| *Track productivity trends* | *Generate decks from notes* |

---

## 🛠️ Tech Stack

*   **Frontend:** React 19 (Hooks, Context, Functional Components)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS (Custom configuration for animations & fonts)
*   **AI SDK:** `@google/genai` (Google Gemini API)
*   **Icons:** Custom SVG Component System
*   **Persistence:** LocalStorage (Offline capable)

---

## 🚀 Getting Started

### Prerequisites
1.  **Node.js** (v18+ recommended)
2.  **Google Gemini API Key**: You can get one from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/taskflow-ai.git
    cd taskflow-ai
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory (or configure your build tool):
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

4.  **Run the App**
    ```bash
    npm run dev
    ```

---

## 📖 Usage Guide

### Managing Tickets
1.  Click **"New Task"** to create a ticket.
2.  **Drag and drop** tickets between columns to change status.
3.  **Check the boxes** on ticket cards to activate the **Bulk Action Bar** at the bottom of the screen.

### Using the AI Sidebar
1.  Click the **"Ask AI"** button in the sidebar.
2.  Select a mode at the top:
    *   **Fast:** General questions about your tasks.
    *   **Explorer:** "Find coffee shops near [Location]" (Requires Location Permissions).
    *   **Artist:** "Generate a cyberpunk city."
3.  Type your query. The AI automatically receives a context summary of your current board.

### Notes & Slides
1.  Navigate to the **Notes** view.
2.  Write in Markdown.
3.  Click **"Magic Slide"** to generate a visual deck from your text.
4.  Click **"Add to Calendar"** to turn the note title/content into a new Task.

---

## 🛡️ Privacy & Data

*   **Local Storage:** All task data, notes, and settings are stored locally in your browser's `localStorage`. No data is sent to a backend database.
*   **AI Data:** Task data is sent to the Google Gemini API **only** when you interact with the AI Chat to provide context.

---

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ using React & Gemini.**