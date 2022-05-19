/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

/*
 * https://www.npmjs.com/package/openapi-typescript-codegen
 * sudo npm install openapi-typescript-codegen -g
 * openapi -i https://open-api.netlify.com/swagger.json -o netlify -c fetch --name NetlifyClient  --useOptions --indent 2
 */

import type { BaseHttpRequest } from "./core/BaseHttpRequest.ts";
import type { OpenAPIConfig } from "./core/OpenAPI.ts";
import { FetchHttpRequest } from "./core/FetchHttpRequest.ts";

import { AccessTokenService } from "./services/AccessTokenService.ts";
import { AccountMembershipService } from "./services/AccountMembershipService.ts";
import { AccountTypeService } from "./services/AccountTypeService.ts";
import { AssetService } from "./services/AssetService.ts";
import { AssetPublicSignatureService } from "./services/AssetPublicSignatureService.ts";
import { AuditLogService } from "./services/AuditLogService.ts";
import { BuildService } from "./services/BuildService.ts";
import { BuildHookService } from "./services/BuildHookService.ts";
import { BuildLogMsgService } from "./services/BuildLogMsgService.ts";
import { DeployService } from "./services/DeployService.ts";
import { DeployedBranchService } from "./services/DeployedBranchService.ts";
import { DeployKeyService } from "./services/DeployKeyService.ts";
import { DnsZoneService } from "./services/DnsZoneService.ts";
import { FileService } from "./services/FileService.ts";
import { FormService } from "./services/FormService.ts";
import { FunctionService } from "./services/FunctionService.ts";
import { HookService } from "./services/HookService.ts";
import { HookTypeService } from "./services/HookTypeService.ts";
import { MemberService } from "./services/MemberService.ts";
import { MetadataService } from "./services/MetadataService.ts";
import { PaymentMethodService } from "./services/PaymentMethodService.ts";
import { ServiceService } from "./services/ServiceService.ts";
import { ServiceInstanceService } from "./services/ServiceInstanceService.ts";
import { SiteService } from "./services/SiteService.ts";
import { SniCertificateService } from "./services/SniCertificateService.ts";
import { SnippetService } from "./services/SnippetService.ts";
import { SplitTestService } from "./services/SplitTestService.ts";
import { SubmissionService } from "./services/SubmissionService.ts";
import { TicketService } from "./services/TicketService.ts";
import { UserService } from "./services/UserService.ts";
import { XInternalService } from "./services/XInternalService.ts";

type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;

export class NetlifyClient {
  public readonly accessToken: AccessTokenService;
  public readonly accountMembership: AccountMembershipService;
  public readonly accountType: AccountTypeService;
  public readonly asset: AssetService;
  public readonly assetPublicSignature: AssetPublicSignatureService;
  public readonly auditLog: AuditLogService;
  public readonly build: BuildService;
  public readonly buildHook: BuildHookService;
  public readonly buildLogMsg: BuildLogMsgService;
  public readonly deploy: DeployService;
  public readonly deployedBranch: DeployedBranchService;
  public readonly deployKey: DeployKeyService;
  public readonly dnsZone: DnsZoneService;
  public readonly file: FileService;
  public readonly form: FormService;
  public readonly function: FunctionService;
  public readonly hook: HookService;
  public readonly hookType: HookTypeService;
  public readonly member: MemberService;
  public readonly metadata: MetadataService;
  public readonly paymentMethod: PaymentMethodService;
  public readonly service: ServiceService;
  public readonly serviceInstance: ServiceInstanceService;
  public readonly site: SiteService;
  public readonly sniCertificate: SniCertificateService;
  public readonly snippet: SnippetService;
  public readonly splitTest: SplitTestService;
  public readonly submission: SubmissionService;
  public readonly ticket: TicketService;
  public readonly user: UserService;
  public readonly xInternal: XInternalService;

  public readonly request: BaseHttpRequest;

  constructor(
    config?: Partial<OpenAPIConfig>,
    HttpRequest: HttpRequestConstructor = FetchHttpRequest,
  ) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? "https://api.netlify.com/api/v1",
      VERSION: config?.VERSION ?? "2.9.0",
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? "include",
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    });

    this.accessToken = new AccessTokenService(this.request);
    this.accountMembership = new AccountMembershipService(this.request);
    this.accountType = new AccountTypeService(this.request);
    this.asset = new AssetService(this.request);
    this.assetPublicSignature = new AssetPublicSignatureService(this.request);
    this.auditLog = new AuditLogService(this.request);
    this.build = new BuildService(this.request);
    this.buildHook = new BuildHookService(this.request);
    this.buildLogMsg = new BuildLogMsgService(this.request);
    this.deploy = new DeployService(this.request);
    this.deployedBranch = new DeployedBranchService(this.request);
    this.deployKey = new DeployKeyService(this.request);
    this.dnsZone = new DnsZoneService(this.request);
    this.file = new FileService(this.request);
    this.form = new FormService(this.request);
    this.function = new FunctionService(this.request);
    this.hook = new HookService(this.request);
    this.hookType = new HookTypeService(this.request);
    this.member = new MemberService(this.request);
    this.metadata = new MetadataService(this.request);
    this.paymentMethod = new PaymentMethodService(this.request);
    this.service = new ServiceService(this.request);
    this.serviceInstance = new ServiceInstanceService(this.request);
    this.site = new SiteService(this.request);
    this.sniCertificate = new SniCertificateService(this.request);
    this.snippet = new SnippetService(this.request);
    this.splitTest = new SplitTestService(this.request);
    this.submission = new SubmissionService(this.request);
    this.ticket = new TicketService(this.request);
    this.user = new UserService(this.request);
    this.xInternal = new XInternalService(this.request);
  }
}
