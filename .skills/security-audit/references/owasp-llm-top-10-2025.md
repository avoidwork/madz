# OWASP LLM Top 10 2025 — Security Scanning Reference

> Source: [OWASP Top 10 for Large Language Model Applications v2.0](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
> Generated from the official vulnerability entries.

---

## Overview

The OWASP Top 10 for LLM Applications highlights the most critical security risks specific to LLM-integrated systems. The 2025 edition reflects real-world incidents and evolving attack patterns, including expanded coverage of agentic architectures, RAG/vector stores, prompt leakage, and resource abuse. Each entry below summarizes the vulnerability, key indicators to scan for, and prevention measures.

---

## LLM01:2025 — Prompt Injection

**Description:** User prompts manipulate the LLM's behavior or output in unintended ways, including bypassing safety measures, exfiltrating data, or executing unauthorized actions. Affects both direct user input and indirect inputs from external sources (e.g., web pages, files, RAG documents).

**Key Prevention Measures:**
- Constrain model behavior via system prompts (role, capabilities, limitations)
- Define and validate expected output formats with deterministic code
- Implement input and output filtering (semantic filters, RAG Triad evaluation)
- Enforce least-privilege access; handle privileged functions in code, not the model
- Require human approval for high-risk actions
- Segregate and clearly mark external/untrusted content
- Conduct regular adversarial testing and red teaming

**Notable Indicators:**
- Direct injections: user input directly alters model behavior
- Indirect injections: external content (web pages, files, RAG sources) alters behavior
- Multimodal injections: hidden instructions embedded in images or other modalities
- Payload splitting: malicious content split across multiple inputs
- Multilingual/obfuscated attacks using encoding (Base64, emojis) to evade filters

---

## LLM02:2025 — Sensitive Information Disclosure

**Description:** LLMs expose PII, financial details, health records, confidential business data, security credentials, or proprietary algorithms through their output. Risks include unauthorized data access, privacy violations, and intellectual property breaches.

**Key Prevention Measures:**
- Integrate data sanitization (scrubbing/masking) before training or processing
- Apply strict input validation to detect and filter sensitive data
- Enforce least-privilege access controls on sensitive data
- Restrict model access to external data sources; secure runtime data orchestration
- Use federated learning and differential privacy techniques
- Educate users on safe LLM usage and provide opt-out policies
- Conceal system preamble; follow OWASP API Security Misconfiguration guidelines
- Apply tokenization, redaction, and homomorphic encryption where applicable

**Notable Indicators:**
- PII leakage in model responses
- Proprietary algorithm or training data exposure (enables inversion/extraction attacks)
- Sensitive business data inadvertently included in generated responses
- Training data memorization leading to reconstruction attacks

---

## LLM03:2025 — Supply Chain

**Description:** LLM supply chains (data sources, pre-trained models, fine-tuning adapters, deployment platforms) are vulnerable to tampering, poisoning, and exploitation through third-party components. Risks include biased outputs, security breaches, and system failures.

**Key Prevention Measures:**
- Vet data sources and suppliers; audit their security posture and T&Cs regularly
- Apply OWASP A06:2021 (Vulnerable and Outdated Components) practices
- Conduct comprehensive AI Red Teaming and evaluations before model adoption
- Maintain an up-to-date SBOM (Software Bill of Materials) — evaluate OWASP CycloneDX, AI BOMs, ML SBOMs
- Use models only from verifiable sources; apply signing and file hash integrity checks
- Implement strict monitoring/auditing for collaborative model development environments
- Run anomaly detection and adversarial robustness tests on supplied models and data
- Implement patching policies for outdated components
- Encrypt on-device models with integrity checks and vendor attestation

**Notable Indicators:**
- Traditional third-party package vulnerabilities (outdated/deprecated components)
- Licensing risks from diverse open-source and proprietary licenses
- Outdated or deprecated models no longer maintained
- Vulnerable pre-trained models (hidden biases, backdoors via ROME/lobo techniques)
- Weak model provenance (no origin guarantees; account compromise on model repos)
- Vulnerable LoRA adapters (compromised fine-tuning layers)
- Exploited collaborative development processes (model merge services, format converters)
- On-device LLM supply chain risks (tampered manufacturing, firmware exploitation)
- Unclear T&Cs and data privacy policies leading to unauthorized data usage

---

## LLM04:2025 — Data and Model Poisoning

**Description:** Pre-training, fine-tuning, or embedding data is manipulated to introduce vulnerabilities, backdoors, or biases. This integrity attack can compromise model security, performance, and ethical behavior across the LLM lifecycle.

**Key Prevention Measures:**
- Track data origins and transformations using CycloneDX or ML-BOM; verify data legitimacy
- Vet data vendors rigorously; validate model outputs against trusted sources
- Implement strict sandboxing; use anomaly detection to filter adversarial data
- Use specific datasets for fine-tuning per use case
- Ensure infrastructure controls prevent access to unintended data sources
- Use data version control (DVC) to track dataset changes
- Store user-supplied info in vector databases (adjust without retraining)
- Test robustness with red team campaigns and adversarial techniques
- Monitor training loss and analyze model behavior for poisoning signs
- Integrate RAG and grounding techniques during inference

**Notable Indicators:**
- Harmful data introduced during training → biased outputs
- Malicious content injected directly into training process
- Users unknowingly injecting sensitive/proprietary information during interactions
- Unverified training data → biased or erroneous outputs
- Lack of resource access restrictions → unsafe data ingestion
- Backdoor triggers creating "sleeper agent" behavior

---

## LLM05:2025 — Improper Output Handling

**Description:** Insufficient validation, sanitization, and handling of LLM-generated outputs before they are passed downstream. Can result in XSS, CSRF, SSRF, privilege escalation, or remote code execution on backend systems.

**Key Prevention Measures:**
- Treat the model as any other user — apply zero-trust input validation on responses
- Follow OWASP ASVS guidelines for input validation and sanitization
- Encode model output back to users (HTML encoding, SQL escaping, etc.)
- Use parameterized queries or prepared statements for all database operations
- Implement strict Content Security Policies (CSP) to mitigate XSS
- Implement robust logging and monitoring for unusual output patterns

**Notable Indicators:**
- LLM output passed directly to system shell/exec/eval → remote code execution
- JavaScript/Markdown generated and rendered in browser → XSS
- LLM-generated SQL executed without parameterization → SQL injection
- LLM output used to construct file paths → path traversal
- LLM-generated email content without escaping → phishing/XSS

---

## LLM06:2025 — Excessive Agency

**Description:** LLM-based systems are granted excessive functionality, permissions, or autonomy to call functions or interface with external systems. Damaging actions can be performed in response to hallucinations, prompt injections, or ambiguous outputs.

**Key Prevention Measures:**
- Minimize extensions — only expose the minimum necessary tools
- Minimize extension functionality — limit functions to what's required
- Avoid open-ended extensions (e.g., arbitrary shell commands); use granular alternatives
- Minimize extension permissions — apply least privilege to downstream systems
- Execute extensions in the user's context with OAuth and minimum required scope
- Require human approval for high-impact actions (human-in-the-loop)
- Implement complete mediation — enforce authorization in downstream systems, not the LLM
- Sanitize LLM inputs and outputs; use SAST/DAST/IAST in pipelines
- Log and monitor extension activity; implement rate-limiting

**Notable Indicators:**
- Excessive functionality: extensions include unnecessary functions (e.g., delete when only read is needed)
- Excessive permissions: extensions use overly broad identities (e.g., DB admin for read-only operations)
- Excessive autonomy: high-impact actions performed without user confirmation
- Open-ended extensions allowing arbitrary commands (shell access, URL fetching)

---

## LLM07:2025 — System Prompt Leakage

**Description:** System prompts containing sensitive information (credentials, connection strings, internal rules, role structures) are extracted by attackers. The real risk is not the disclosure itself, but the underlying security failures it enables (bypassed authorization, exposed secrets, revealed guardrails).

**Key Prevention Measures:**
- Never embed sensitive data (API keys, credentials, DB names, user roles) in system prompts
- Avoid relying on system prompts for strict behavior control — use external systems
- Implement guardrails outside the LLM (independent output inspection systems)
- Enforce security controls (privilege separation, authorization bounds) independently of the LLM
- Use multiple agents with least privileges for tasks requiring different access levels

**Notable Indicators:**
- System prompts containing credentials, API keys, or database connection strings
- System prompts revealing internal rules (transaction limits, loan amounts, filtering criteria)
- System prompts exposing role-based permissions or user role structures
- System prompts revealing filtering/rejection criteria that attackers can bypass

---

## LLM08:2025 — Vector and Embedding Weaknesses

**Description:** Weaknesses in how vectors and embeddings are generated, stored, or retrieved in RAG systems can be exploited to inject harmful content, manipulate outputs, or access sensitive information. Includes unauthorized access, cross-context leaks, embedding inversion, and data poisoning.

**Key Prevention Measures:**
- Implement fine-grained access controls and permission-aware vector stores
- Ensure strict logical partitioning of datasets by user class/group
- Implement robust data validation pipelines for knowledge sources
- Regularly audit and validate knowledge base integrity for hidden codes/poisoning
- Accept data only from trusted and verified sources
- Review and classify combined datasets; tag data to control access levels
- Maintain detailed immutable logs of retrieval activities

**Notable Indicators:**
- Unauthorized access to embeddings containing sensitive information
- Cross-context information leaks in multi-tenant vector databases
- Embedding inversion attacks recovering source information
- Data poisoning via hidden text in documents (e.g., white-on-white text in resumes)
- Behavior alteration of foundation models after RAG augmentation (e.g., reduced empathy)
- Data federation knowledge conflicts from contradictory sources

---

## LLM09:2025 — Misinformation

**Description:** LLMs produce false or misleading information that appears credible, caused by hallucinations, training data biases, or incomplete information. Overreliance by users exacerbates the impact, leading to security breaches, reputational damage, and legal liability.

**Key Prevention Measures:**
- Use Retrieval-Augmented Generation (RAG) with verified external sources
- Fine-tune models and use parameter-efficient tuning (PET) and chain-of-thought prompting
- Implement cross-verification with trusted external sources and human oversight
- Deploy automatic validation mechanisms for high-stakes outputs
- Clearly communicate risks and limitations to users (risk communication)
- Establish secure coding practices to prevent insecure code suggestions
- Design user interfaces that encourage responsible use (content filters, AI labeling, limitation disclosures)
- Provide comprehensive user training on LLM limitations and critical thinking

**Notable Indicators:**
- Factual inaccuracies in generated content (e.g., incorrect travel info, medical advice)
- Unsupported claims, especially in sensitive contexts (healthcare, legal)
- Misrepresentation of expertise (illusion of understanding complex topics)
- Unsafe code generation (insecure or non-existent libraries suggested)
- Hallucinated package names exploited via malicious repository packages

---

## LLM10:2025 — Unbounded Consumption

**Description:** LLM applications allow excessive, uncontrolled inferences, leading to denial of service (DoS), economic losses (Denial of Wallet), model theft, and service degradation. High computational demands in cloud environments make LLMs vulnerable to resource exploitation.

**Key Prevention Measures:**
- Implement strict input validation with reasonable size limits
- Limit exposure of logits and logprobs in API responses
- Apply rate limiting and user quotas per source entity
- Monitor and manage resource allocation dynamically
- Set timeouts and throttle resource-intensive operations
- Restrict LLM access to network resources, internal services, and APIs (sandboxing)
- Implement comprehensive logging, monitoring, and anomaly detection
- Use watermarking frameworks to detect unauthorized use of outputs
- Design graceful degradation under heavy load
- Limit queued actions; implement dynamic scaling and load balancing
- Train models to detect adversarial queries and extraction attempts
- Filter glitch tokens from output before adding to context window
- Implement RBAC and least privilege for model repositories
- Maintain a centralized ML model inventory/registry
- Use automated MLOps deployment with governance and approval workflows

**Notable Indicators:**
- Variable-length input floods exploiting processing inefficiencies
- Denial of Wallet (DoW) — high-volume operations exploiting pay-per-use models
- Continuous input overflow exceeding context window
- Resource-intensive queries draining CPU/memory
- Model extraction via API using crafted inputs and prompt injection
- Functional model replication via synthetic training data generation
- Side-channel attacks harvesting model weights through input filtering

---

## Cross-Cutting Observations

| Theme | Related Entries |
|-------|----------------|
| Prompt injection as a primary attack vector | LLM01, LLM02, LLM05, LLM06, LLM07, LLM08, LLM10 |
| Data/model integrity | LLM03, LLM04, LLM08 |
| Access control & least privilege | LLM02, LLM05, LLM06, LLM07, LLM08, LLM10 |
| Output validation & sanitization | LLM05, LLM06, LLM07 |
| Monitoring & logging | LLM05, LLM06, LLM08, LLM10 |
| RAG-specific risks | LLM01, LLM04, LLM08, LLM09 |
| Supply chain & provenance | LLM03, LLM04, LLM10 |

---

*This reference is intended for security scanning context. For full details, see the official OWASP LLM Top 10 2025 documentation and the linked references in each entry.*
