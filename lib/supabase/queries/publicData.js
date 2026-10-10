export async function getPublicDemographics() {
  return {
    total: 867,
    male: 449,
    female: 418,
    teachers: 24,
    classes: 12,
    gradeLevels: 4,
    byGrade: {
      7: { male: 128, female: 111, total: 239 },
      8: { male: 111, female: 112, total: 223 },
      9: { male: 99, female: 103, total: 202 },
      10: { male: 111, female: 92, total: 203 },
    },
  };
}
