// Platform-aware transport routing for the outbox drain worker. A user can hold two device tokens at
// once (an FCM token for alerts/background pushes and a PushKit VoIP token for the CallKit ring), and
// the two need different providers: FCM for everything, APNs for `apns-push-type: voip`. The router
// picks exactly one transport per row so a single call never double-pushes or rings twice.
package notifications

import (
	"context"
	"errors"
	"fmt"
)

// Token kinds stored in notifications.push_tokens.token_kind.
const (
	TokenKindPush = "push"
	TokenKindVoIP = "voip"
)

// RoutedMessage is one drainable outbox row plus the transport hints from its push token.
type RoutedMessage struct {
	// Platform is the registered device platform: ios, android, web ("" when unrecorded).
	Platform string
	// TokenKind is push or voip (see TokenKindPush / TokenKindVoIP).
	TokenKind string
	Token     string
	Title     string
	Body      string
	Data      []byte
}

// SenderRouter delivers one message to the transport that owns its token. Implementations must be
// safe for concurrent use and must never log the token.
type SenderRouter interface {
	Send(ctx context.Context, m RoutedMessage) error
}

// voipSupporter is implemented by routers that can deliver a PushKit wake-up. The drain worker uses
// it to decide whether selecting a `voip` token can succeed at all: without an APNs transport a
// PushKit token is undeliverable (it is not an FCM registration token), so the drain must prefer the
// `push` token instead of burning the retry budget on FCM rejections.
type voipSupporter interface {
	SupportsVoIP() bool
}

// SupportsVoIP reports whether this router can deliver to a voip token. A router that does not
// implement SupportsVoIP is assumed capable (single-transport test doubles keep working).
func SupportsVoIP(r SenderRouter) bool {
	if r == nil {
		return false
	}
	if s, ok := r.(voipSupporter); ok {
		return s.SupportsVoIP()
	}
	return true
}

// MultiSender routes iOS VoIP tokens to APNs and everything else to FCM. Either transport may be nil
// (credentials unset); the router then degrades to the other one instead of dropping pushes.
type MultiSender struct {
	fcm  Sender
	apns Sender
}

// NewMultiSender builds the router. It returns nil when neither transport is configured so the
// worker stays disabled (an admin drain keeps returning 503 push_unconfigured).
func NewMultiSender(fcm, apns Sender) SenderRouter {
	if fcm == nil && apns == nil {
		return nil
	}
	return &MultiSender{fcm: fcm, apns: apns}
}

// Send routes one push. A VoIP token can only be delivered by APNs; an iOS alert/background token
// still goes through FCM (which relays to APNs without the voip push type). Android and web are
// always FCM.
func (m *MultiSender) Send(ctx context.Context, msg RoutedMessage) error {
	apns := m.apns
	fcm := m.fcm
	if msg.TokenKind == TokenKindVoIP {
		if apns != nil {
			return apns.Send(ctx, msg.Token, msg.Title, msg.Body, msg.Data)
		}
		// A PushKit token is not an FCM registration token: handing it to FCM can only produce a
		// permanent rejection. Report it honestly so the drain marks the row FAILED (retryable) and
		// logs a real cause instead of a provider error that looks like a bad device.
		if fcm != nil {
			return errors.New("notifications: voip token but no APNs transport configured")
		}
		return errors.New("notifications: no transport for a voip token")
	}
	if fcm != nil {
		return fcm.Send(ctx, msg.Token, msg.Title, msg.Body, msg.Data)
	}
	// No FCM: an iOS alert token can still be relayed to APNs directly. Any other platform has no
	// transport left (an Android/web token cannot be delivered by APNs).
	if apns != nil && msg.Platform == "ios" {
		return apns.Send(ctx, msg.Token, msg.Title, msg.Body, msg.Data)
	}
	return errors.New("notifications: no transport configured for this token")
}

// SupportsVoIP reports whether a PushKit token has a live transport (APNs credentials provisioned).
func (m *MultiSender) SupportsVoIP() bool { return m != nil && m.apns != nil }

// Configured returns which transports are live, for the greppable boot log.
func (m *MultiSender) Configured() string {
	switch {
	case m == nil:
		return ""
	case m.apns != nil && m.fcm != nil:
		return "apns+fcm"
	case m.apns != nil:
		return "apns"
	case m.fcm != nil:
		return "fcm"
	default:
		return ""
	}
}

// SingleSender adapts a plain Sender into a SenderRouter for tests and single-transport setups.
func SingleSender(s Sender) SenderRouter {
	if s == nil {
		return nil
	}
	return singleSender{s: s}
}

type singleSender struct{ s Sender }

func (s singleSender) Send(ctx context.Context, m RoutedMessage) error {
	if s.s == nil {
		return fmt.Errorf("notifications: no transport for token kind %q", m.TokenKind)
	}
	return s.s.Send(ctx, m.Token, m.Title, m.Body, m.Data)
}
