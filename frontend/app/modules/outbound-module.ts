import CoreModule from "diagram-js/lib/core";
import { OutboundCollaborationService } from "../services/outbound-service";
import { ModuleDeclaration } from "diagram-js";

const OutboundCollaborationModule: ModuleDeclaration = {
  __depends__: [CoreModule],
  __init__: ["OutboundCollaborationService"],
  outboundCollaborationService: ["type", OutboundCollaborationService],
};

export default OutboundCollaborationModule;
