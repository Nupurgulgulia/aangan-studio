import { TestCall } from "./test-call";

export default function TestCallPage() {
  return (
    <>
      <h1>Test call</h1>
      <p className="sub">
        Talk to the Aangan voice agent from this browser, exactly as an inbound caller would (no phone number needed).
        Speak Hindi, Marathi or English. After you hang up, score the call to send it through the same pipeline as a
        real phone call.
      </p>
      <TestCall />
    </>
  );
}
