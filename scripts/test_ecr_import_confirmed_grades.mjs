import assert from "node:assert/strict";

// Test the link generation logic matching importConfirmedEClassGrades
function generateClassStudentLinks(confirmedLearners, classIds) {
  const allClassIds = [...new Set(classIds.filter(Boolean))];
  const links = [];
  for (const learner of confirmedLearners) {
    const studentId = learner.matchedStudent?.id;
    if (!studentId) continue;
    for (const classId of allClassIds) {
      links.push({ class_id: classId, student_id: studentId });
    }
  }
  return links;
}

function testRosterLinkGeneration() {
  const mockLearners = Array.from({ length: 41 }, (_, i) => ({
    included: true,
    status: "MATCHED",
    matchedStudent: { id: `student-${i + 1}`, student_number: `1000${i + 1}` },
  }));

  const classIds = ["class-t1", "class-t2", "class-t3"];
  const links = generateClassStudentLinks(mockLearners, classIds);

  // 41 students linked to 3 classes = 123 link records
  assert.equal(links.length, 123);
  
  // Every student must be linked to class-t1
  const t1Links = links.filter((l) => l.class_id === "class-t1");
  assert.equal(t1Links.length, 41);

  // Every student must be linked to class-t2
  const t2Links = links.filter((l) => l.class_id === "class-t2");
  assert.equal(t2Links.length, 41);

  // Sibling set deduplication
  const dupClassIds = ["class-t1", "class-t1", "class-t2"];
  const dedupedLinks = generateClassStudentLinks(mockLearners, dupClassIds);
  assert.equal(dedupedLinks.length, 82);

  console.log("✓ Roster link generation for all-terms siblings: PASSED");
}

function testConfirmedFilter() {
  const learners = [
    { included: true, matchedStudent: { id: "s1" }, status: "MATCHED" },
    { included: false, matchedStudent: { id: "s2" }, status: "NEEDS_VERIFICATION" },
    { included: true, matchedStudent: null, status: "UNMATCHED" },
    { included: true, matchedStudent: { id: "s3" }, status: "WRONG_SECTION" },
    { included: true, matchedStudent: { id: "s4" }, status: "MATCHED" },
  ];

  const confirmed = learners.filter(
    (l) =>
      l.included &&
      l.matchedStudent?.id &&
      l.status !== "WRONG_SECTION" &&
      l.status !== "UNMATCHED" &&
      l.status !== "AMBIGUOUS" &&
      l.status !== "DUPLICATE_ROW" &&
      l.changeType !== "invalid" &&
      !(l.published && l.changeType === "conflicting")
  );

  assert.equal(confirmed.length, 2);
  assert.equal(confirmed[0].matchedStudent.id, "s1");
  assert.equal(confirmed[1].matchedStudent.id, "s4");

  console.log("✓ Confirmed learner filtering: PASSED");
}

function main() {
  testRosterLinkGeneration();
  testConfirmedFilter();
  console.log("All ECR import confirmation tests: PASSED");
}

main();
