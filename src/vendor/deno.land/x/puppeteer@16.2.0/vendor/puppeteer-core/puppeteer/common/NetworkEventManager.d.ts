import { Protocol } from "../../vendor/devtools-protocol/types/protocol.d.ts";
import { HTTPRequest } from "./HTTPRequest.js";
/**
 * @internal
 */
export declare type QueuedEventGroup = {
  responseReceivedEvent: Protocol.Network.ResponseReceivedEvent;
  loadingFinishedEvent?: Protocol.Network.LoadingFinishedEvent;
  loadingFailedEvent?: Protocol.Network.LoadingFailedEvent;
};
/**
 * @internal
 */
export declare type FetchRequestId = string;
/**
 * @internal
 */
export declare type RedirectInfo = {
  event: Protocol.Network.RequestWillBeSentEvent;
  fetchRequestId?: FetchRequestId;
};
/**
 * @internal
 */
export declare type NetworkRequestId = string;
/**
 * Helper class to track network events by request ID
 *
 * @internal
 */
export declare class NetworkEventManager {
  #private;
  forget(networkRequestId: NetworkRequestId): void;
  responseExtraInfo(
    networkRequestId: NetworkRequestId,
  ): Protocol.Network.ResponseReceivedExtraInfoEvent[];
  private queuedRedirectInfo;
  queueRedirectInfo(
    fetchRequestId: FetchRequestId,
    redirectInfo: RedirectInfo,
  ): void;
  takeQueuedRedirectInfo(
    fetchRequestId: FetchRequestId,
  ): RedirectInfo | undefined;
  numRequestsInProgress(): number;
  storeRequestWillBeSent(
    networkRequestId: NetworkRequestId,
    event: Protocol.Network.RequestWillBeSentEvent,
  ): void;
  getRequestWillBeSent(
    networkRequestId: NetworkRequestId,
  ): Protocol.Network.RequestWillBeSentEvent | undefined;
  forgetRequestWillBeSent(networkRequestId: NetworkRequestId): void;
  getRequestPaused(
    networkRequestId: NetworkRequestId,
  ): Protocol.Fetch.RequestPausedEvent | undefined;
  forgetRequestPaused(networkRequestId: NetworkRequestId): void;
  storeRequestPaused(
    networkRequestId: NetworkRequestId,
    event: Protocol.Fetch.RequestPausedEvent,
  ): void;
  getRequest(networkRequestId: NetworkRequestId): HTTPRequest | undefined;
  storeRequest(networkRequestId: NetworkRequestId, request: HTTPRequest): void;
  forgetRequest(networkRequestId: NetworkRequestId): void;
  getQueuedEventGroup(
    networkRequestId: NetworkRequestId,
  ): QueuedEventGroup | undefined;
  queueEventGroup(
    networkRequestId: NetworkRequestId,
    event: QueuedEventGroup,
  ): void;
  forgetQueuedEventGroup(networkRequestId: NetworkRequestId): void;
}
