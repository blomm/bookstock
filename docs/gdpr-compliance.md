# GDPR Compliance Documentation

## BookStock Data Protection & Privacy Compliance

**Document Version:** 1.0
**Last Updated:** January 2025
**Review Date:** July 2025
**Owner:** Data Protection Officer

## Executive Summary

This document outlines BookStock's compliance with the General Data Protection Regulation (GDPR) and other applicable data protection laws. It details our data processing activities, security measures, and procedures for protecting user privacy.

## Table of Contents

1. [Legal Basis for Processing](#legal-basis-for-processing)
2. [Data We Collect](#data-we-collect)
3. [How We Use Data](#how-we-use-data)
4. [Data Subject Rights](#data-subject-rights)
5. [Security Measures](#security-measures)
6. [Data Retention](#data-retention)
7. [Third-Party Processors](#third-party-processors)
8. [Data Breach Procedures](#data-breach-procedures)
9. [Privacy by Design](#privacy-by-design)
10. [Compliance Checklist](#compliance-checklist)

## Legal Basis for Processing

### Lawful Bases Under GDPR Article 6

BookStock processes personal data under the following lawful bases:

#### 1. Contract (Article 6(1)(b))
- **Purpose**: Providing the BookStock service
- **Data**: User account information, authentication data
- **Justification**: Necessary to perform the contract with our users

#### 2. Legitimate Interest (Article 6(1)(f))
- **Purpose**: System security, fraud prevention, audit logging
- **Data**: IP addresses, login attempts, activity logs
- **Justification**: Protecting our systems and user data
- **Balancing Test**: Security benefits outweigh minimal privacy impact

#### 3. Legal Obligation (Article 6(1)(c))
- **Purpose**: Compliance with financial and tax regulations
- **Data**: Transaction records, audit trails
- **Justification**: Required by law for financial record-keeping

#### 4. Consent (Article 6(1)(a))
- **Purpose**: Optional features (e.g., marketing emails)
- **Data**: Email address, preferences
- **Justification**: User has given clear, affirmative consent
- **Withdrawal**: Can be withdrawn at any time

## Data We Collect

### Personal Data Categories

#### 1. Identity Data
- **Data**: First name, last name
- **Source**: User registration
- **Purpose**: User identification, account management
- **Legal Basis**: Contract
- **Retention**: Duration of account + 1 year

#### 2. Contact Data
- **Data**: Email address
- **Source**: User registration
- **Purpose**: Authentication, communication
- **Legal Basis**: Contract
- **Retention**: Duration of account + 1 year

#### 3. Account Data
- **Data**: Username, password (encrypted), Clerk ID
- **Source**: User registration, Clerk authentication
- **Purpose**: Authentication, access control
- **Legal Basis**: Contract
- **Retention**: Duration of account + 1 year
- **Special Notes**: Passwords never stored in plain text

#### 4. Usage Data
- **Data**: IP address, browser type, access times, pages viewed
- **Source**: Automatic collection
- **Purpose**: Security, system monitoring, performance
- **Legal Basis**: Legitimate interest
- **Retention**: 90 days (rolling)

#### 5. Audit Log Data
- **Data**: User actions, timestamps, IP addresses, user agents
- **Source**: Automatic logging of protected actions
- **Purpose**: Security, compliance, accountability
- **Legal Basis**: Legitimate interest + Legal obligation
- **Retention**: 7 years (compliance requirement)

#### 6. Role & Permission Data
- **Data**: Assigned roles, permissions, role history
- **Source**: Administrator assignments
- **Purpose**: Access control, authorization
- **Legal Basis**: Contract
- **Retention**: Duration of account + 1 year

### Data We Don't Collect

✅ **We do NOT collect:**
- Social security numbers
- Payment card information
- Biometric data
- Health information
- Political opinions
- Religious beliefs
- Trade union membership
- Sexual orientation
- Criminal history
- Precise geolocation data
- Tracking cookies for advertising

### Special Category Data

BookStock does NOT process any "special category data" as defined in GDPR Article 9:
- Racial or ethnic origin
- Political opinions
- Religious or philosophical beliefs
- Trade union membership
- Genetic data
- Biometric data
- Health data
- Sex life or sexual orientation

## How We Use Data

### Primary Purposes

#### 1. Service Delivery
**Data Used**: Identity, Contact, Account, Role data
**Activities**:
- Creating and managing user accounts
- Authenticating users
- Providing access to appropriate features
- Personalizing user experience

#### 2. Security & Fraud Prevention
**Data Used**: Usage data, Audit logs, Account data
**Activities**:
- Detecting unauthorized access attempts
- Preventing security breaches
- Identifying suspicious activity
- Protecting system integrity

#### 3. Compliance & Legal Obligations
**Data Used**: Audit logs, Transaction records
**Activities**:
- Maintaining audit trails
- Responding to legal requests
- Regulatory compliance
- Financial record-keeping

#### 4. System Improvement
**Data Used**: Usage data (anonymized)
**Activities**:
- Analyzing system performance
- Identifying bugs and errors
- Improving user experience
- Developing new features

### Data Sharing

**Internal Sharing:**
- System administrators (for support and maintenance)
- Designated security personnel (for security monitoring)
- Data protection officer (for compliance)

**External Sharing:**
- We do NOT sell user data
- We do NOT share data with advertisers
- We share with processors only (see Third-Party Processors section)

**Legal Disclosure:**
- We may disclose data if required by law
- In response to valid legal process
- To protect rights and safety
- With user's consent

## Data Subject Rights

Under GDPR, users have the following rights:

### 1. Right to Access (Article 15)

**What it means**: Users can request a copy of their personal data

**How to exercise**:
1. Sign in to BookStock
2. Navigate to Profile → Privacy → Request My Data
3. Click "Download My Data"
4. Receive export within 30 days

**What we provide**:
- All personal data we hold
- Categories of data
- Purposes of processing
- Recipients of data
- Retention periods
- Data sources

**Format**: JSON export with human-readable summary

### 2. Right to Rectification (Article 16)

**What it means**: Users can correct inaccurate data

**How to exercise**:
1. Sign in to BookStock
2. Navigate to Profile → Account Settings
3. Update information
4. Click "Save"

**Or contact**: System administrator for data you can't edit

**Response time**: Immediate for self-service, 30 days for administrator changes

### 3. Right to Erasure / "Right to be Forgotten" (Article 17)

**What it means**: Users can request deletion of their data

**How to exercise**:
1. Sign in to BookStock
2. Navigate to Profile → Privacy → Delete Account
3. Confirm deletion request
4. Account deleted within 30 days

**Limitations**:
- We may retain audit logs (anonymized) for compliance
- We may retain data needed for legal obligations
- We may retain data for defense of legal claims

**What happens**:
- Account deactivated immediately
- Personal data deleted within 30 days
- Audit logs anonymized (user ID replaced with "DELETED_USER")
- Email sent confirming deletion

### 4. Right to Restriction (Article 18)

**What it means**: Users can request we limit processing of their data

**How to exercise**: Contact data protection officer

**When applicable**:
- Contesting accuracy of data
- Processing is unlawful
- We no longer need data but user needs it for legal claims
- Objecting to processing pending verification

**Response time**: 30 days

### 5. Right to Data Portability (Article 20)

**What it means**: Users can receive their data in a machine-readable format

**How to exercise**:
1. Same as Right to Access
2. Data exported in JSON format
3. Can be imported to another system

**Scope**: Data provided by user or generated through use of service

**Format**: Structured JSON with schema documentation

### 6. Right to Object (Article 21)

**What it means**: Users can object to certain types of processing

**How to exercise**: Contact data protection officer

**Applicable to**:
- Processing based on legitimate interests
- Direct marketing (if applicable)
- Profiling (we don't do this)

**Response time**: 30 days

### 7. Rights Related to Automated Decision-Making (Article 22)

**Not Applicable**: BookStock does not perform automated decision-making or profiling that produces legal or similarly significant effects.

### Exercising Rights

**Contact Information**:
- **Email**: privacy@bookstock.com (or company DPO email)
- **In-App**: Profile → Privacy → Data Rights
- **Mail**: [Company address for DPO]

**Response Time**: 30 days (may extend to 60 days for complex requests)

**Verification**: We may request proof of identity to prevent unauthorized disclosure

**No Cost**: Exercising rights is free, unless requests are manifestly unfounded or excessive

## Security Measures

### Technical Measures

#### 1. Encryption

**In Transit**:
- TLS 1.3 for all connections
- HTTPS enforced site-wide
- No HTTP fallback allowed

**At Rest**:
- Database encryption enabled
- Passwords hashed with bcrypt
- JWT tokens encrypted
- Backup encryption

**Key Management**:
- Regular key rotation
- Secure key storage
- Principle of least privilege

#### 2. Authentication & Authorization

**Authentication**:
- Clerk-managed secure authentication
- Multi-factor authentication supported
- Password strength requirements
- Session timeout after inactivity
- Secure password reset flow

**Authorization**:
- Role-based access control (RBAC)
- Principle of least privilege
- Permission checks on every request
- Server-side enforcement

#### 3. Access Controls

**System Access**:
- Individual user accounts (no shared accounts)
- Strong password requirements
- MFA for administrators
- Regular access reviews

**Database Access**:
- Principle of least privilege
- Separate credentials per environment
- Read-only access for analytics
- Audit logging of all access

**Admin Access**:
- Separate admin accounts
- Additional authentication required
- All actions logged
- Regular access audits

#### 4. Monitoring & Logging

**Security Monitoring**:
- Real-time intrusion detection
- Failed login attempt monitoring
- Unusual activity alerts
- Rate limiting on sensitive endpoints

**Audit Logging**:
- All data access logged
- All modifications logged
- Logs immutable and tamper-proof
- 7-year retention

**Log Protection**:
- Separate storage from application data
- Access restricted to security team
- Regular integrity checks
- Encrypted storage

#### 5. Vulnerability Management

**Regular Updates**:
- Dependency updates weekly
- Security patches within 24 hours
- Regular security audits
- Penetration testing annually

**Secure Development**:
- Security code reviews
- Automated security scanning
- Input validation everywhere
- Output encoding

**Testing**:
- Comprehensive security test suite
- Authentication bypass tests
- Injection attack tests
- XSS/CSRF protection tests

### Organizational Measures

#### 1. Staff Training

**Requirements**:
- GDPR training for all staff
- Security awareness training
- Phishing simulation exercises
- Annual refresher training

**Topics Covered**:
- Data protection principles
- Recognizing security threats
- Incident response procedures
- Privacy by design

#### 2. Policies & Procedures

**Documentation**:
- Data Protection Policy
- Information Security Policy
- Incident Response Plan
- Business Continuity Plan
- Disaster Recovery Plan

**Review Schedule**:
- Annual policy review
- Update after incidents
- Compliance checks quarterly

#### 3. Vendor Management

**Third-Party Processors**:
- Data Processing Agreements (DPAs)
- Regular security assessments
- Compliance verification
- Right to audit

**Vendor Requirements**:
- GDPR compliance
- SOC 2 certification (or equivalent)
- Transparent security practices
- Incident notification procedures

#### 4. Incident Response

**Breach Response Plan**:
1. Contain the breach
2. Assess severity and scope
3. Notify DPO within 1 hour
4. Notify supervisory authority within 72 hours (if required)
5. Notify affected users without undue delay
6. Document incident
7. Implement corrective actions
8. Post-incident review

**Breach Notification**:
- Supervised authority: Within 72 hours
- Affected users: Without undue delay
- Details: Nature, consequences, mitigation
- Contact: DPO contact information

## Data Retention

### Retention Periods

| Data Category | Retention Period | Justification | Deletion Method |
|---------------|------------------|---------------|-----------------|
| User Account Data | Account lifetime + 1 year | Contract, Support | Permanent deletion |
| Audit Logs | 7 years | Legal obligation | Anonymization after account deletion |
| Usage Logs | 90 days | Legitimate interest | Automatic deletion |
| Session Data | 7 days or logout | Contract | Automatic expiry |
| Backup Data | 30 days | Business continuity | Automatic rotation |
| Deleted Account Data | 30 days | Recovery period | Permanent deletion |

### Retention Review

- Annual review of retention periods
- Documented retention schedule
- Automated deletion where possible
- Manual review for exceptions

### Deletion Procedures

**Automatic Deletion**:
- Session data after expiry
- Usage logs after 90 days
- Backup data after 30 days

**Manual Deletion**:
- Account deletion requests
- Right to erasure requests
- End of retention period

**Verification**:
- Deletion confirmed in logs
- Backups purged
- No traces remain

## Third-Party Processors

### Data Processors We Use

#### 1. Clerk (Authentication)

**Service**: User authentication and identity management
**Data Processed**: Email, password (encrypted), user profile
**Location**: United States (Privacy Shield certified)
**DPA**: ✅ In place
**Security Certification**: SOC 2 Type II
**Data Residency**: US with EU data centers available
**Sub-processors**: Disclosed on Clerk website

**Why we use them**: Industry-leading security, GDPR compliant, reduces our security burden

#### 2. Vercel (Hosting)

**Service**: Application hosting and infrastructure
**Data Processed**: All application data
**Location**: EU region (Frankfurt)
**DPA**: ✅ In place
**Security Certification**: SOC 2 Type II, ISO 27001
**Data Residency**: EU
**Sub-processors**: AWS (Frankfurt region)

**Why we use them**: Fast, reliable, GDPR compliant, EU data centers

#### 3. PostgreSQL Database (Self-Hosted or Managed)

**Service**: Data storage
**Data Processed**: All application data
**Location**: [Specify your hosting location]
**DPA**: ✅ In place (if managed)
**Security**: Encrypted at rest and in transit
**Backups**: Daily, encrypted, EU region

**Why we use them**: Reliable, secure, open-source

### Processor Requirements

All processors must:
- ✅ Sign Data Processing Agreement (DPA)
- ✅ Provide GDPR compliance evidence
- ✅ Maintain appropriate security measures
- ✅ Notify us of breaches within 24 hours
- ✅ Allow audits
- ✅ Delete data upon termination
- ✅ Not sub-process without approval

### Processor Audits

- Annual security questionnaire
- Review of compliance certifications
- Incident review
- Contract review

## Data Breach Procedures

### Breach Definition

A data breach is any incident that leads to:
- Unauthorized access to personal data
- Accidental or unlawful destruction of data
- Loss, alteration, or disclosure of data
- Unauthorized transmission of data

### Detection

**Monitoring**:
- Real-time security alerts
- Automated anomaly detection
- User reports
- Regular security audits

**Indicators**:
- Unusual data access patterns
- Failed authentication spikes
- Unexpected data modifications
- System intrusions

### Response Procedures

#### Phase 1: Detection & Containment (0-1 hour)

1. **Detect** breach through monitoring or report
2. **Contain** breach immediately:
   - Isolate affected systems
   - Revoke compromised credentials
   - Block malicious IPs
   - Preserve evidence
3. **Notify** DPO and security team
4. **Assemble** incident response team

#### Phase 2: Assessment (1-24 hours)

1. **Assess** scope and severity:
   - What data was affected?
   - How many users affected?
   - What is the risk level?
   - How did it occur?
2. **Document** everything:
   - Timeline of events
   - Data affected
   - Actions taken
   - Evidence collected

#### Phase 3: Notification (24-72 hours)

1. **Supervisory Authority** (if required):
   - Within 72 hours
   - Nature of breach
   - Categories and number affected
   - Consequences
   - Measures taken
   - Contact point

2. **Affected Users** (if high risk):
   - Without undue delay
   - Clear, plain language
   - What happened
   - What data affected
   - What we're doing
   - What they should do
   - Contact information

#### Phase 4: Recovery (72+ hours)

1. **Implement** fixes:
   - Patch vulnerabilities
   - Strengthen security
   - Reset passwords if needed
   - Restore systems

2. **Monitor** for further issues

3. **Communicate** updates to affected parties

#### Phase 5: Review (1-2 weeks after)

1. **Post-incident review**:
   - Root cause analysis
   - What went well?
   - What could be improved?
   - Lessons learned

2. **Update** procedures and controls

3. **Document** final report

4. **Train** staff on improvements

### Breach Severity Levels

**High Risk** (requires user notification):
- Financial data exposed
- Authentication credentials exposed
- Large number of users affected
- Sensitive business data exposed

**Medium Risk** (may require notification):
- Limited personal data exposed
- Small number of users affected
- Risk can be mitigated

**Low Risk** (internal documentation only):
- No personal data exposed
- Immediate containment successful
- No user impact

### Breach Register

We maintain a register of all breaches including:
- Date and time
- Description
- Data affected
- Number of users affected
- Actions taken
- Notifications sent
- Outcome

## Privacy by Design

### Principles

#### 1. Proactive not Reactive
- Security built in from the start
- Regular security reviews
- Threat modeling
- Anticipate risks

#### 2. Privacy as Default
- Minimal data collection
- Strong default privacy settings
- No tracking without consent
- Session-based authentication

#### 3. Privacy Embedded in Design
- Security in every feature
- Privacy impact assessments
- Code reviews for privacy
- Testing for privacy

#### 4. Full Functionality
- Privacy doesn't reduce functionality
- Positive-sum not zero-sum
- Security enhances experience

#### 5. End-to-End Security
- From registration to deletion
- All stages of data lifecycle
- Secure by default

#### 6. Visibility and Transparency
- Clear privacy policies
- Accessible privacy settings
- Transparent data practices
- Regular communications

#### 7. Respect for User Privacy
- User rights first
- Easy to exercise rights
- Minimal data retention
- User control

### Implementation

**Data Minimization**:
- Only collect necessary data
- No "nice to have" fields
- Regular data audits
- Automatic deletion

**Anonymization**:
- Audit logs anonymized after account deletion
- Usage data aggregated
- No personal identifiers in analytics

**Access Controls**:
- Role-based access
- Principle of least privilege
- Regular access reviews
- Time-limited access

**User Control**:
- Self-service data access
- Self-service data correction
- Self-service account deletion
- Clear privacy settings

## Compliance Checklist

### GDPR Compliance Checklist

- ✅ Lawful basis for processing identified
- ✅ Privacy policy published
- ✅ Data subject rights implemented
- ✅ Consent mechanisms (where applicable)
- ✅ Data breach procedures established
- ✅ DPO appointed (if required)
- ✅ Data Protection Impact Assessment completed
- ✅ Records of processing activities maintained
- ✅ Data Processing Agreements with processors
- ✅ Staff training on GDPR
- ✅ Security measures implemented
- ✅ Data retention schedule established
- ✅ Right to portability implemented
- ✅ Privacy by design principles followed
- ✅ Children's data protection (N/A - B2B system)
- ✅ International transfers compliance (if applicable)
- ✅ Audit trail maintained
- ✅ Regular compliance reviews

### Ongoing Compliance Tasks

**Monthly**:
- Review security alerts
- Check system logs
- Update security documentation

**Quarterly**:
- Access rights review
- Policy compliance check
- Vendor compliance review

**Annually**:
- Full GDPR audit
- Policy updates
- Staff training
- Penetration testing
- Data inventory update
- Risk assessment

### Compliance Documentation

All compliance documentation maintained:
- Records of processing activities
- Privacy impact assessments
- Data breach register
- Training records
- Audit reports
- DPAs with processors
- Policy documents
- User rights requests log

## International Data Transfers

### Data Residency

**Primary Storage**: EU (Frankfurt region)
**Backup Storage**: EU region
**Processing Location**: EU

### Transfers Outside EU

**Clerk (US)**:
- Standard Contractual Clauses in place
- Privacy Shield certified
- EU data centers available

**Adequacy Decision**: We prioritize processors in countries with EU adequacy decisions

**Safeguards**: All international transfers protected by:
- Standard Contractual Clauses (SCCs)
- Binding Corporate Rules (where applicable)
- Adequacy decisions
- Explicit user consent (where required)

## Contact Information

### Data Protection Officer

**Email**: privacy@bookstock.com
**Response Time**: 48 hours
**Escalation**: [Management contact]

### Supervisory Authority

Users have the right to lodge a complaint with their supervisory authority:

**Ireland** (if using Clerk):
Data Protection Commission
21 Fitzwilliam Square South
Dublin 2, D02 RD28
Ireland
Phone: +353 57 868 4800
Email: info@dataprotection.ie

**Your Local Authority**: [Specify relevant supervisory authority]

## Document Control

**Version History**:
- v1.0 - January 2025 - Initial version

**Review Schedule**: Every 6 months or after:
- Significant system changes
- Data breaches
- Regulatory changes
- Processor changes

**Approval**: Approved by Data Protection Officer

**Distribution**: Published internally and available to users on request

---

**Last Reviewed**: January 2025
**Next Review**: July 2025
**Document Owner**: Data Protection Officer
