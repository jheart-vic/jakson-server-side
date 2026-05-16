const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: String,
  },
  { timestamps: true }
);

appSettingsSchema.statics.get = async function (key) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

appSettingsSchema.statics.set = async function (key, value) {
  return this.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('AppSettings', appSettingsSchema);
