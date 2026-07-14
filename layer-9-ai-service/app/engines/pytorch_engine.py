from app.core.engine import BaseEngine, PredictionResult, FeatureVector
from typing import List
import torch
import torch.nn as nn

# --- Model Architecture ---
class LSTMModel(nn.Module):
    def __init__(self, input_size=14, hidden_size=50, num_layers=2, output_size=1):
        super(LSTMModel, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out

class PyTorchEngine(BaseEngine):
    def __init__(self):
        self.model = LSTMModel()
        self.model.eval()
        # In real world: self.model.load_state_dict(torch.load("path/to/model.pth"))

    def predict(self, symbol: str, features: List[FeatureVector]) -> PredictionResult:
        """
        Returns ABSTAIN — the model has no trained weights and must not fabricate.
        Rule 13: never fabricate a value. Absent trained weights → null prediction.
        """
        return PredictionResult(
            prediction=None,
            confidence=None,
            model_version="v1.0.0-lstm-untrained",
            status="not_trained",
            reasoning="LSTM model architecture exists but has no trained weights. "
                       "A Phase-0 breadth study must prove a post-cost edge before training begins. "
                       "Until validated, the engine abstains — never a fabricated number."
        )
