const fs = require('fs');
const path = 'src/pages/CreateTripPage.tsx';
let content = fs.readFileSync(path, 'utf8');
const target = `                                         value={act.description}
                                          onChange={e => setFormState(p => ({
                                            ...p,
                                            timeline: p.timeline.map((s, idx) => idx === i ? {
                                              ...s,
                                              activities: s.activities.map((a, aidx) => aidx === j ? { ...a, description: e.target.value } : a)
                                            } : s)
                                          }))}
                                        />
                                     </div>`;

const replacement = `                                         value={act.description}
                                          onChange={e => setFormState(p => ({
                                            ...p,
                                            timeline: p.timeline.map((s, idx) => idx === i ? {
                                              ...s,
                                              activities: s.activities.map((a, aidx) => aidx === j ? { ...a, description: e.target.value } : a)
                                            } : s)
                                          }))}
                                        />
                                     </div>
                                     <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                        <label className="field-label" style={{ fontSize: '0.75rem' }}>External Link</label>
                                        <input 
                                          className="input" 
                                          style={{ fontSize: '0.8rem' }}
                                          placeholder="https://..." 
                                          value={act.link || ''}
                                          onChange={e => setFormState(p => ({
                                            ...p,
                                            timeline: p.timeline.map((s, idx) => idx === i ? {
                                              ...s,
                                              activities: s.activities.map((a, aidx) => aidx === j ? { ...a, link: e.target.value } : a)
                                            } : s)
                                          }))}
                                        />
                                     </div>`;

// Since indentation is tricky, I'll use a regex that is more flexible
const regex = /placeholder="Brief details\.\.\."[\s\S]+?<\/div>/;
content = content.replace(regex, (match) => {
    return match + `
                                     <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                        <label className="field-label" style={{ fontSize: '0.75rem' }}>External Link</label>
                                        <input 
                                          className="input" 
                                          style={{ fontSize: '0.8rem' }}
                                          placeholder="https://..." 
                                          value={act.link || ''}
                                          onChange={e => setFormState(p => ({
                                            ...p,
                                            timeline: p.timeline.map((s, idx) => idx === i ? {
                                              ...s,
                                              activities: s.activities.map((a, aidx) => aidx === j ? { ...a, link: e.target.value } : a)
                                            } : s)
                                          }))}
                                        />
                                     </div>`;
});

fs.writeFileSync(path, content);
console.log('Link added to CreateTripPage.tsx');
