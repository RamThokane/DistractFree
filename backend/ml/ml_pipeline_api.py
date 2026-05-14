import os
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import matplotlib.pyplot as plt
from flask import Flask, request, jsonify

# ==============================================================================
# 1️⃣ Dataset Creation (Sample Dataset)
# ==============================================================================
def generate_synthetic_dataset(n_samples=1000):
    """
    Creates a synthetic dataset of user browsing behaviour.
    """
    np.random.seed(42)
    
    # Generate random features
    session_duration = np.random.randint(5, 120, n_samples)  # in minutes
    tab_switch_count = np.random.randint(0, 50, n_samples)
    interruptions = np.random.randint(0, 20, n_samples)
    block_attempts = np.random.randint(0, 15, n_samples)
    
    # Determine result (Focused or Distracted) based on a logical rule with some noise
    # Distracted logic: lots of tab switches, interruptions, block attempts, and short duration
    distracted_score = (tab_switch_count * 1.5) + (interruptions * 3) + (block_attempts * 5) - (session_duration * 0.2)
    
    # Add random noise
    distracted_score += np.random.normal(0, 10, n_samples)
    
    # Threshold for distracted (1) vs focused (0)
    # Let's say if score > 30, distracted
    result = np.where(distracted_score > 30, 'Distracted', 'Focused')
    
    df = pd.DataFrame({
        'session_duration': session_duration,
        'tab_switch_count': tab_switch_count,
        'interruptions': interruptions,
        'block_attempts': block_attempts,
        'result': result
    })
    
    return df

# ==============================================================================
# 2️⃣ Data Preprocessing
# ==============================================================================
def preprocess_data(df):
    """
    Preprocess data: handle missing values, label encoding, and feature separation.
    """
    # Handle missing values (if any)
    df = df.fillna(df.mean(numeric_only=True))
    
    # Label encoding: Focused = 0, Distracted = 1
    df['result_encoded'] = df['result'].map({'Focused': 0, 'Distracted': 1})
    
    # Feature separation
    X = df[['session_duration', 'tab_switch_count', 'interruptions', 'block_attempts']]
    y = df['result_encoded']
    
    return X, y, None

# ==============================================================================
# 3️⃣ Train Decision Tree Model
# ==============================================================================
def train_model(X, y):
    """
    Split dataset, train the model, and save it.
    """
    # Split dataset: Training set (70%), Testing set (30%)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    
    # Train model
    model = DecisionTreeClassifier(max_depth=5, random_state=42)
    model.fit(X_train, y_train)
    
    # Save trained model
    os.makedirs('model', exist_ok=True)
    joblib.dump(model, 'model/distractfree_model.pkl')
    print("Model trained and saved as 'model/distractfree_model.pkl'")
    
    return model, X_test, y_test

# ==============================================================================
# 4️⃣ Model Evaluation
# ==============================================================================
def evaluate_model(model, X_test, y_test):
    """
    Calculate metrics and display confusion matrix.
    """
    y_pred = model.predict(X_test)
    
    print("\nModel Evaluation Metrics:")
    print("-" * 30)
    print(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Focused (0)", "Distracted (1)"]))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

# ==============================================================================
# 5️⃣ Prediction Function
# ==============================================================================
def predict_focus(duration, tab_switches, interruptions, block_attempts):
    """
    Predict if a user is Focused or Distracted based on input features.
    """
    # Load model
    try:
        model = joblib.load('model/distractfree_model.pkl')
    except FileNotFoundError:
        return "Model not found. Please train it first."
        
    # Prepare input array
    features = np.array([[duration, tab_switches, interruptions, block_attempts]])
    
    # Predict
    prediction_encoded = model.predict(features)[0]
    
    # Decode: 0 -> Focused, 1 -> Distracted
    return "Distracted" if prediction_encoded == 1 else "Focused"

# ==============================================================================
# 6️⃣ Model Visualization
# ==============================================================================
def visualize_model(model, feature_names):
    """
    Generate and save Decision Tree diagram.
    """
    plt.figure(figsize=(20,10))
    plot_tree(model, 
              feature_names=feature_names, 
              class_names=["Focused", "Distracted"],
              filled=True, 
              rounded=True, 
              fontsize=10)
    
    plt.savefig('model/decision_tree.png')
    print("\nDecision Tree diagram saved as 'model/decision_tree.png'")

# ==============================================================================
# 7️⃣ API Integration (Flask)
# ==============================================================================
app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict_api():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Extract features
        duration = data.get('duration', 0)
        tab_switches = data.get('tab_switches', 0)
        interruptions = data.get('interruptions', 0)
        block_attempts = data.get('block_attempts', 0)
        
        # Load model
        try:
            model = joblib.load('model/distractfree_model.pkl')
        except FileNotFoundError:
            return jsonify({"error": "Model not found. Please train it first."}), 500
        
        # Prepare input array
        features = np.array([[duration, tab_switches, interruptions, block_attempts]])
        feature_names = ['session_duration', 'tab_switch_count', 'interruptions', 'block_attempts']
        
        # Predict
        prediction_encoded = model.predict(features)[0]
        prediction = "Distracted" if prediction_encoded == 1 else "Focused"
        
        # Confidence (probability)
        confidence = 0.0
        probabilities = {}
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(features)[0]
            confidence = round(float(max(proba)) * 100, 1)
            probabilities = {
                "Focused": round(float(proba[0]) * 100, 1),
                "Distracted": round(float(proba[1]) * 100, 1) if len(proba) > 1 else 0
            }
        
        # Feature importance
        importance = {}
        if hasattr(model, 'feature_importances_'):
            for name, imp in zip(feature_names, model.feature_importances_):
                importance[name] = round(float(imp) * 100, 1)
        
        # Generate explanation
        explanation_parts = []
        if tab_switches > 10:
            explanation_parts.append(f"High tab switching ({tab_switches} switches) indicates distraction.")
        if interruptions > 5:
            explanation_parts.append(f"Frequent interruptions ({interruptions}) reduce focus quality.")
        if block_attempts > 3:
            explanation_parts.append(f"Multiple blocked site attempts ({block_attempts}) suggest urge to browse.")
        if duration < 15:
            explanation_parts.append(f"Short session ({duration} min) may not reach deep focus.")
        if duration >= 50 and tab_switches < 5 and block_attempts < 2:
            explanation_parts.append(f"Long focused session ({duration} min) with minimal distractions — excellent!")
        
        if not explanation_parts:
            explanation_parts.append("Your session metrics are within normal range.")
        
        # Return enhanced JSON response
        return jsonify({
            "prediction": prediction,
            "confidence": confidence,
            "probabilities": probabilities,
            "feature_importance": importance,
            "explanation": " ".join(explanation_parts),
            "features_received": {
                "duration": duration,
                "tab_switches": tab_switches,
                "interruptions": interruptions,
                "block_attempts": block_attempts
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ==============================================================================
# Main Execution
# ==============================================================================
if __name__ == "__main__":
    print("DistractFree Machine Learning Pipeline\n")
    
    # 1. Generate Data
    df = generate_synthetic_dataset(1000)
    print("Synthetic dataset created (1000 records).")
    
    # 2. Preprocess Data
    X, y, le = preprocess_data(df)
    print("Data preprocessed.")
    
    # 3. Train Model
    model, X_test, y_test = train_model(X, y)
    
    # 4. Evaluate Model
    evaluate_model(model, X_test, y_test)
    
    # 5. Test Prediction Function
    print("\nTesting Prediction Function:")
    test_pred = predict_focus(10, 8, 5, 3)
    print(f"Input: (10, 8, 5, 3) -> Output: {test_pred}")
    
    # 6. Visualize Model
    feature_names = ['session_duration', 'tab_switch_count', 'interruptions', 'block_attempts']
    visualize_model(model, feature_names)
    
    # 7. Start API Server
    print("\nStarting Flask API Server on port 5001...")
    # Using port 5001 since Node.js backend is running on 5000
    app.run(host='0.0.0.0', port=5001, debug=False)
