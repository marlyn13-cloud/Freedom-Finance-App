# Freedom Finance

# Overview

Freedom Finance is a privacy focused personal finance dashboard designed to help users track their income, expenses, and monthly budgets. The application transforms  financial data into clear and actionable insights.

A core feature of Freedom Finance is Spark AI, an embedded local artificial intelligence assistant. By running a Small Large Language Model (LLM)  in the browser, the app guarantees that sensitive financial data never leaves the user's device while still providing intelligent insights about their spending habits.

# ✨ Features

-  *Comprehensive Dashboard:* Get a overview of your net balance, total income, expenses, and savings with visual progress tracking.

- *Spark AI Assistant:* A chatbot that answers questions about your finances. It uses a hybrid architecture combining fast paths for mathematical accuracy with an LLM fallback for conversational flexibility.

- *Advanced Transaction Management:* Add, edit, delete, and search transactions instantly using search logic.

- *Smart Budgeting:* Set monthly limits for custom categories. Visual graphs alert you when you are on track, nearing your limit, or over budget.

- *Data Visualization & Export:* View spending breakdowns through interactive charts and generate PDF reports of your financial history.

- *Local Storage & Authentication:* A simulated authentication system that keeps all user profiles, transactions, and budgets secured in local browser storage.

# 🛠️ Technology Stack
Frontend / UI:

- HTML, CSS, JavaScript

- D3.js (Data Visualization & Graph Generation)

- jsPDF & jsPDF-AutoTable (PDF Report Generation)

Machine Learning / AI:

- Rivescript.js (Rule based conversational routing)

- Transformers.js (machine learning pipeline)

- LangChain.js (Prompt templating/engineering)

- Hugging Face Models (SmolLM-135M-Instruct)

### Sample AI Example:

<img width="342" height="500" alt="image" src="https://github.com/user-attachments/assets/065c734e-40ab-450d-9d45-c947eb74cb9d" />

## 🧠 What I Learned

- *AI Integration:* Successfully deployed a Hugging Face transformer model directly in the browser. I learned how to **manage prompt engineering** with strict ChatML formatting to prevent model hallucinations.

- *AI Architecture:* Discovered the limitations of small parameter models with raw math. I engineered a JavaScript solution for complex algorithmic calculations (like finding the highest expense or calculating budget limits).

- *Client-Side State Management:* Developed a system using the Web Storage API to manage data across users, transactions, and budgets without relying on a backend database.

#  Try Live Demo for FREE!!

https://marlyn13-cloud.github.io/Freedom-Finance-App/

-----------------------------------------------------------------------------------------------------------------------------------------

Designed and engineered by Marlyn Grullon.
