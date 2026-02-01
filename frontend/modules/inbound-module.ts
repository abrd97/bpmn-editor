import CoreModule from "diagram-js/lib/core";
import CommandModule from "diagram-js/lib/command";
import ModelingModule from "bpmn-js/lib/features/modeling";
import { InboundBpmnService } from "@/services";
import { ModuleDeclaration } from "diagram-js";

const InboundBpmnModule: ModuleDeclaration = {
  __depends__: [CoreModule, CommandModule, ModelingModule],
  __init__: ["inboundBpmnService"],
  inboundBpmnService: ["type", InboundBpmnService],
};

export default InboundBpmnModule;
