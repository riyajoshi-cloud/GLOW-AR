#!/usr/bin/env python3
"""
GLOW AR — Dermal AI Diagnostics Model Simulator
This script showcases the mathematical and neural network logic powering the 
AIRIS™ AI Skin Diagnostics module. It reproduces the feature extraction, 
feedforward matrix transformations, and prediction steps in Python.
"""

import math

class SkinDermalAI:
    def __init__(self):
        # We define the calibrated weights and biases for the neural network.
        # Layer 1: Input (8 features) -> Hidden (12 units)
        # Weights represent a projection mapping cheek color, variance, and dark circles to hidden features.
        self.W1 = [
            [-0.15,  0.22, -0.40,  0.11, -0.05, -0.32,  0.48, -0.19,  0.15, -0.08, -0.25,  0.30], # Mean R
            [ 0.12, -0.35,  0.25, -0.18,  0.30,  0.41, -0.22,  0.08, -0.11,  0.23,  0.35, -0.15], # Mean G
            [ 0.08, -0.15,  0.10, -0.05,  0.22,  0.19, -0.15,  0.02, -0.08,  0.15,  0.20, -0.11], # Mean B
            [-0.45, -0.20, -0.55,  0.32, -0.38, -0.42, -0.60,  0.25, -0.30,  0.38, -0.50, -0.28], # Norm StdDev (Uniformity)
            [ 0.38,  0.45,  0.20, -0.35,  0.42,  0.30,  0.48, -0.18,  0.32, -0.44,  0.55,  0.22], # Under-Eye ratio (Dark Circles)
            [-0.50,  0.28, -0.65,  0.40, -0.48, -0.38, -0.72,  0.30, -0.42,  0.50, -0.65, -0.35], # Redness index
            [ 0.20, -0.18,  0.32, -0.10,  0.25,  0.28, -0.15,  0.05, -0.10,  0.18,  0.28, -0.12], # Cheek Luminance
            [ 0.05, -0.08,  0.08, -0.02,  0.10,  0.06, -0.04,  0.01, -0.05,  0.08,  0.10, -0.06]  # Symmetry ratio
        ]
        
        self.b1 = [0.10, -0.05, 0.15, -0.08, 0.05, 0.12, 0.20, -0.02, 0.08, -0.05, 0.15, 0.02]
        
        # Layer 2: Hidden (12 units) -> Output (4 units: Hydration, Uniformity, Redness, Spots)
        self.W2 = [
            # Hydration, Uniformity, Redness, Spots
            [ 0.52,      0.65,      -0.45,   -0.38], # Hidden 0
            [-0.40,     -0.35,       0.55,    0.48], # Hidden 1
            [ 0.60,      0.72,      -0.50,   -0.42], # Hidden 2
            [-0.35,     -0.30,       0.45,    0.38], # Hidden 3
            [ 0.42,      0.50,      -0.38,   -0.32], # Hidden 4
            [ 0.48,      0.55,      -0.40,   -0.35], # Hidden 5
            [-0.55,     -0.62,       0.68,    0.58], # Hidden 6
            [ 0.30,      0.35,      -0.25,   -0.22], # Hidden 7
            [-0.42,     -0.48,       0.50,    0.42], # Hidden 8
            [ 0.38,      0.44,      -0.32,   -0.28], # Hidden 9
            [ 0.50,      0.58,      -0.42,   -0.36], # Hidden 10
            [-0.28,     -0.32,       0.35,    0.30]  # Hidden 11
        ]
        
        self.b2 = [0.45, 0.50, 0.20, 0.25]

    def _relu(self, x):
        """Rectified Linear Unit activation function"""
        return max(0.0, x)

    def _sigmoid(self, x):
        """Sigmoid activation function mapping outputs to [0, 1]"""
        try:
            return 1.0 / (1.0 + math.exp(-x))
        except OverflowError:
            return 0.0 if x < 0 else 1.0

    def extract_features(self, left_cheek, right_cheek, left_eye_under, right_eye_under):
        """
        Replicates raw getRegionMetrics step in JavaScript.
        Input params are regional pixel metric dictionaries:
        e.g., {'r': 180, 'g': 150, 'b': 140, 'std_dev': 12.5, 'mean_l': 155.0}
        """
        avg_r = (left_cheek['r'] + right_cheek['r']) / 2.0
        avg_g = (left_cheek['g'] + right_cheek['g']) / 2.0
        avg_b = (left_cheek['b'] + right_cheek['b']) / 2.0
        avg_std = (left_cheek['std_dev'] + right_cheek['std_dev']) / 2.0
        avg_l = (left_cheek['mean_l'] + right_cheek['mean_l']) / 2.0
        
        avg_eye_l = (left_eye_under['mean_l'] + right_eye_under['mean_l']) / 2.0

        # Normalization and Feature assembly (corresponds to JS featureVector array)
        features = [
            avg_r / 255.0,                                      # 1. Normalized Red
            avg_g / 255.0,                                      # 2. Normalized Green
            avg_b / 255.0,                                      # 3. Normalized Blue
            min(1.0, avg_std / 50.0),                          # 4. Texture variance std dev
            min(2.0, avg_eye_l / (avg_l if avg_l > 0 else 1.0)),# 5. Under-eye/cheek dark ratio
            (avg_r / avg_g) if avg_g > 0 else 1.0,              # 6. Redness ratio
            avg_l / 255.0,                                      # 7. Overall brightness L
            (right_cheek['mean_l'] / left_cheek['mean_l']) if left_cheek['mean_l'] > 0 else 1.0 # 8. Symmetry
        ]
        return features

    def run_inference(self, features):
        """
        Calculates feed-forward prediction pass matching tfjs model layers.
        """
        # Step 1: Input Layer -> Hidden Layer (Matrix Multiplication + Biases)
        hidden_outputs = []
        for j in range(12): # 12 Hidden Units
            node_sum = 0.0
            for i in range(8): # 8 Inputs
                node_sum += features[i] * self.W1[i][j]
            node_sum += self.b1[j]
            hidden_outputs.append(self._relu(node_sum)) # ReLU

        # Step 2: Hidden Layer -> Output Layer (Matrix Multiplication + Biases)
        predictions = []
        for k in range(4): # 4 Target Metrics
            node_sum = 0.0
            for j in range(12): # 12 Hidden Units
                node_sum += hidden_outputs[j] * self.W2[j][k]
            node_sum += self.b2[k]
            predictions.append(self._sigmoid(node_sum)) # Sigmoid

        # Step 3: Denormalize Outputs to 0-100% metrics and clamp within valid bounds
        hydration = max(40, min(99, round(predictions[0] * 100)))
        uniformity = max(40, min(99, round(predictions[1] * 100)))
        redness = max(5, min(95, round(predictions[2] * 100)))
        spots = max(5, min(95, round(predictions[3] * 100)))

        # Overall Score: Balanced average rating
        health_score = round((hydration + uniformity + (100 - redness) + (100 - spots)) / 4)

        return {
            "health_score": health_score,
            "hydration": hydration,
            "uniformity": uniformity,
            "redness": redness,
            "spots": spots
        }

# ==========================================
# SIMULATED RUNS SHOWCASING AI UTILITY
# ==========================================
if __name__ == "__main__":
    detector = SkinDermalAI()
    
    print("-" * 55)
    print(" GLOW AR - CLIENT PORTFOLIO DIAGNOSTIC ALGORITHMS")
    print("-" * 55)

    # Subject Archetype A: Hydrated, uniform skin tone (Balanced)
    print("\n[Subject Archetype A: Healthy Clear Skin Complexion]")
    cheek_l = {'r': 210, 'g': 185, 'b': 175, 'std_dev': 4.5, 'mean_l': 188.0}
    cheek_r = {'r': 212, 'g': 186, 'b': 176, 'std_dev': 4.2, 'mean_l': 189.0}
    eye_l = {'mean_l': 182.0}
    eye_r = {'mean_l': 183.0}
    
    feats = detector.extract_features(cheek_l, cheek_r, eye_l, eye_r)
    results = detector.run_inference(feats)
    print(f"-> Extracted Features: {[round(f, 3) for f in feats]}")
    print(f"-> Model Output : {results}")

    # Subject Archetype B: Under-eye fatigue (Dark Circles) & High Redness (Sensitivity)
    print("\n[Subject Archetype B: Fatigued Skin tone + Cheek Vascular Congestion]")
    cheek_l_dry = {'r': 230, 'g': 160, 'b': 150, 'std_dev': 18.0, 'mean_l': 172.0}
    cheek_r_dry = {'r': 228, 'g': 158, 'b': 148, 'std_dev': 19.5, 'mean_l': 170.0}
    eye_l_dark = {'mean_l': 130.0}  # Dark circles under-eyes (very low relative luminance)
    eye_r_dark = {'mean_l': 128.0}
    
    feats_dry = detector.extract_features(cheek_l_dry, cheek_r_dry, eye_l_dark, eye_r_dark)
    results_dry = detector.run_inference(feats_dry)
    print(f"-> Extracted Features: {[round(f, 3) for f in feats_dry]}")
    print(f"-> Model Output : {results_dry}")
    print("-" * 55)
