import CoreModule from "diagram-js/lib/core";
import CommandModule from "diagram-js/lib/command";
import { OutboundBpmnService } from "@/services";
import { ModuleDeclaration } from "diagram-js";

const OutboundBpmnModule: ModuleDeclaration = {
  __depends__: [CoreModule, CommandModule],
  __init__: ["outboundBpmnService"],
  outboundBpmnService: ["type", OutboundBpmnService],
};

export default OutboundBpmnModule;
