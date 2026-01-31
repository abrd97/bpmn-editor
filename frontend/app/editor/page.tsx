"use client";
import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import GridModule from 'diagram-js-grid';

const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   id="Definitions_1">
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default function EditorPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  useEffect(() => {
    modelerRef.current = new BpmnModeler({
      container: containerRef.current!,
      additionalModules: [GridModule]
    });

    const savedXml = sessionStorage.getItem("bpmn");
    const xml = savedXml || emptyBpmn;

    modelerRef.current.importXML(xml);

    if (savedXml) {
      sessionStorage.removeItem("bpmn");
    }

    return () => modelerRef.current?.destroy();
  }, []);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
