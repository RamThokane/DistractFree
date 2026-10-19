const mongoose = require('mongoose');

/**
 * A trained success model, stored in MongoDB so every server instance (and
 * every Vercel function) uses the same, latest one. Written by
 * ml/nodeTrainer.js after sessions end; read by ml/activeModel.js.
 *
 * Same shape as ml/model/logistic_regression_model.json, plus metrics.
 */
const mlModelSchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'logistic_regression' },
    version: { type: String, required: true, unique: true },
    trainedAt: { type: Date, required: true, index: true },
    featureNames: { type: [String], required: true },
    selectedAtN: Number, // sessions in the data when the inputs were last chosen
    means: { type: [Number], required: true },
    stds: { type: [Number], required: true },
    coefficients: { type: [Number], required: true },
    intercept: { type: Number, required: true },
    C: Number,
    nReal: Number,
    nSamples: Number,
    nUsers: Number,
    classBalance: { successful: Number, not_successful: Number },
    // holdout (newest 20%), walkForward (each block predicted from earlier sessions only)
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    trigger: { type: String, default: 'session_end' },
    trainingMs: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model('MlModel', mlModelSchema);
