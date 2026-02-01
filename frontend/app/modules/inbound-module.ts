import CoreModule from "diagram-js/lib/core";
import { InboundCollaborationService } from "../services/inbound-service";
import { ModuleDeclaration } from "diagram-js";

const InboundCollaborationModule: ModuleDeclaration = {
  __depends__: [CoreModule],
  __init__: ["InboundCollaborationService"],
  inboundCollaborationService: ["type", InboundCollaborationService],
};

export default InboundCollaborationModule;
