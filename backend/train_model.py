
from pathlib import Path
import joblib
import pandas as pd

from preprocessing import clean_text

from sklearn.model_selection import GroupShuffleSplit
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# File paths
BASE_DIR = Path(__file__).resolve().parent

FAKE_PATH = BASE_DIR / "Fake.csv"
REAL_PATH = BASE_DIR / "True.csv"
MODEL_PATH = BASE_DIR / "newsguard_model.pkl"

print("Loading datasets...")

fake_df = pd.read_csv(FAKE_PATH)
real_df = pd.read_csv(REAL_PATH)

fake_df["label"] = "Fake"
real_df["label"] = "Real"

df = pd.concat([fake_df, real_df], ignore_index=True)

# Handle missing values
df["title"] = df["title"].fillna("").astype(str)
df["text"] = df["text"].fillna("").astype(str)

# Remove rows with no usable text
df["title"] = df["title"].str.strip()
df["text"] = df["text"].str.strip()

df = df[
    (df["title"].str.len() > 0) |
    (df["text"].str.len() > 0)
].copy()

# Remove duplicate original articles
df["original_article"] = (
    df["title"] + " " + df["text"]
).str.strip()

df = df.drop_duplicates(subset=["original_article"]).reset_index(drop=True)

print("\nOriginal dataset distribution:")
print(df["label"].value_counts())

# Create different-length examples from each article.
# All versions of one article stay in the same data split.
samples = []
labels = []
groups = []

for article_id, row in df.iterrows():

    title = row["title"]
    text = row["text"]
    label = row["label"]

    full_article = (title + " " + text).strip()

    # Headline-only example
    if title:
        samples.append(title)
        labels.append(label)
        groups.append(article_id)

    # Short excerpt example
    if text:
        short_article = (title + " " + text[:300]).strip()
        samples.append(short_article)
        labels.append(label)
        groups.append(article_id)

    # Medium excerpt example
    if text:
        medium_article = (title + " " + text[:1000]).strip()
        samples.append(medium_article)
        labels.append(label)
        groups.append(article_id)

    # Complete article example
    if full_article:
        samples.append(full_article)
        labels.append(label)
        groups.append(article_id)

X = pd.Series(samples)
y = pd.Series(labels)
groups = pd.Series(groups)

print("\nTraining examples:")
print("Total examples:", len(X))
print(y.value_counts())

# Split by original article to prevent leakage
splitter = GroupShuffleSplit(
    n_splits=1,
    test_size=0.20,
    random_state=42
)

train_indices, test_indices = next(
    splitter.split(X, y, groups)
)

X_train = X.iloc[train_indices]
X_test = X.iloc[test_indices]

y_train = y.iloc[train_indices]
y_test = y.iloc[test_indices]

print("\nTraining examples:", len(X_train))
print("Testing examples:", len(X_test))

# Word-level TF-IDF
word_features = TfidfVectorizer(
    preprocessor=clean_text,
    stop_words="english",
    ngram_range=(1, 2),
    min_df=2,
    max_df=0.95,
    max_features=150000,
    sublinear_tf=True
)

# Character-level TF-IDF
char_features = TfidfVectorizer(
    preprocessor=clean_text,
    analyzer="char",
    ngram_range=(3, 5),
    min_df=3,
    max_features=100000,
    sublinear_tf=True
)

features = FeatureUnion([
    ("word", word_features),
    ("char", char_features)
])

# Classification model
model = Pipeline([
    ("tfidf", features),
    ("classifier", LogisticRegression(
        C=1.0,
        max_iter=2000,
        class_weight="balanced",
        solver="liblinear",
        random_state=42
    ))
])

print("\nTraining NewsGuard AI model...")

model.fit(X_train, y_train)

# Evaluation
print("\nEvaluating model...")

predictions = model.predict(X_test)

print("\nAccuracy:",
      round(accuracy_score(y_test, predictions) * 100, 2), "%")

print("Precision:",
      round(precision_score(
          y_test, predictions, pos_label="Real"
      ) * 100, 2), "%")

print("Recall:",
      round(recall_score(
          y_test, predictions, pos_label="Real"
      ) * 100, 2), "%")

print("F1 Score:",
      round(f1_score(
          y_test, predictions, pos_label="Real"
      ) * 100, 2), "%")

print("\nClassification Report:")
print(classification_report(y_test, predictions))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, predictions))

# Save model
joblib.dump(model, MODEL_PATH)

print("\nNewsGuard AI model saved successfully!")
print("Location:", MODEL_PATH)
