# NewsGuard AI – Fake News Detection Using Machine Learning

## Project Overview

NewsGuard AI is a machine learning project developed to classify whether a news article is **Fake** or **Real** using Natural Language Processing (NLP).

The application allows users to enter a news article or upload a document and get a prediction with confidence scores and a basic explanation.

I developed this project as part of my AI/ML learning journey to understand how machine learning can be used to solve real-world problems.

---

## Objective

The main objective of this project is to detect potentially fake news articles based on their textual content using machine learning techniques.

Fake news has become a major issue in today's digital world, and this project explores how NLP and machine learning can help analyze news content.

---

## Technologies Used

- Python
- Pandas
- NumPy
- Scikit-learn
- NLTK
- Flask
- React.js
- JavaScript
- Vite
- Joblib
- TF-IDF
- Logistic Regression

---

## What I Learned From This Project

While building this project, I learned:

- how to work with real-world news datasets
- how to clean and preprocess text using NLTK
- how TF-IDF converts text into numerical features
- how Logistic Regression works for classification
- how to train, evaluate, save and load machine learning models
- how to connect a React frontend with a Flask backend
- how to display machine learning predictions and confidence scores

This project helped me gain practical experience in developing an end-to-end machine learning application.

---

## How the Project Works

1. The Fake and True news datasets are loaded.
2. The article text is cleaned and preprocessed using NLTK.
3. The cleaned text is converted into numerical features using Word and Character TF-IDF.
4. A Logistic Regression model is trained on the processed data.
5. The model is evaluated using accuracy, precision, recall and F1-score.
6. The trained model is connected to a Flask backend.
7. The React frontend sends the news article to the backend for analysis.
8. The application displays the prediction, confidence score and basic word-level explanation.

---

## Model Performance

- Accuracy: 98.37%
- Precision: 98.35%
- Recall: 98.66%
- F1 Score: 98.51%

---

## Project Structure

```text
Fake-News-WebApp/
│
├── backend/
│   ├── api.py
│   ├── train_model.py
│   ├── preprocessing.py
│   ├── newsguard_model.pkl
│   ├── NewsGuard_AI.ipynb
│   ├── Fake.csv
│   ├── True.csv
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .gitignore
│
├── screenshots/
├── .gitignore
└── README.md
```

---

## How to Run the Project

### Backend

```bash
cd backend
pip install -r requirements.txt
python api.py
```

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## Live Demo

Coming soon.

---
