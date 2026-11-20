// A stand-in for an AI agent CLI: reads the request on stdin, answers in the
// chatty way agents do (prose + a fenced JSON block). Behaviour per argv[2]:
//   good     fix the image with a descriptive alt
//   lazy     alt="image" (the verifier must reject it)
//   flaky    garbage first, a valid patch once told it was wrong
//   json     expects the json input format
//   silent   prints nothing
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  const mode = process.argv[2] ?? "good";
  if (mode === "silent") return;
  let id;
  if (mode === "json") {
    const req = JSON.parse(input);
    if (!req.system || !req.file || !req.schema) throw new Error("bad json request");
    id = req.finding.id;
  } else {
    id = /Finding id: (\S+)/.exec(input)?.[1];
  }
  if (mode === "flaky" && !input.includes("previous response was not valid")) {
    console.log("Sure! Here is the fix: {not json at all}");
    return;
  }
  const alt = mode === "lazy" ? "image" : "Bar chart of sales by quarter";
  const patch = { findingId: id, rationale: "describe the chart", before: '<img src="chart.png">', after: `<img src="chart.png" alt="${alt}">`, confidence: "medium" };
  console.log("I looked at the page. Here is the patch:\n\n```json\n" + JSON.stringify(patch, null, 2) + "\n```\nLet me know if you need anything else.");
});
